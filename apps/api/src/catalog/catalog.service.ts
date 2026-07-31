import { Injectable } from '@nestjs/common';
import { resolveActivePriceRule } from '@lavenet/shared-domain';
import type { CatalogResponse, CatalogService as CatalogServiceDto } from '@lavenet/shared-schemas';
import { CatalogRepository } from './catalog.repository';

interface PriceRuleRecord {
  articleTypeId: string | null;
  amountXof: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  articleType: { name: string } | null;
}

interface ServiceRecord {
  id: string;
  slug: string;
  name: string;
  unit: string;
  processingHours: number;
  priceRules: PriceRuleRecord[];
}

interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  position: number;
  services: ServiceRecord[];
}

// No articleType on a rule (KG services, priced by weight) is grouped under
// this key so its history resolves independently from any per-article-type
// override on the same service.
const BASE_PRICE_GROUP_KEY = '__base__';

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async getPublicCatalog(at: Date = new Date()): Promise<CatalogResponse> {
    const categories = (await this.repository.findPublicCatalog()) as CategoryRecord[];

    return {
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        name: category.name,
        position: category.position,
        services: category.services.map((service) => this.toServiceDto(service, at)),
      })),
    };
  }

  private toServiceDto(service: ServiceRecord, at: Date): CatalogServiceDto {
    const groups = new Map<string, PriceRuleRecord[]>();
    for (const rule of service.priceRules) {
      const key = rule.articleTypeId ?? BASE_PRICE_GROUP_KEY;
      const group = groups.get(key);
      if (group) {
        group.push(rule);
      } else {
        groups.set(key, [rule]);
      }
    }

    const prices = [...groups.values()]
      .map((rules) => resolveActivePriceRule(rules, at))
      .filter((rule): rule is PriceRuleRecord => rule !== undefined)
      .map((rule) => ({
        articleTypeId: rule.articleTypeId,
        articleTypeName: rule.articleType?.name ?? null,
        amountXof: rule.amountXof,
      }));

    return {
      id: service.id,
      slug: service.slug,
      name: service.name,
      unit: service.unit as CatalogServiceDto['unit'],
      processingHours: service.processingHours,
      prices,
    };
  }
}
