import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ColdStartBanner } from './core/http/cold-start-banner';

@Component({
  imports: [RouterOutlet, ColdStartBanner],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'web';
}
