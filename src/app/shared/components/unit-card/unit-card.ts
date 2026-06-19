import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopUnit } from '../../../models/shop-unit.model';

@Component({
  selector: 'app-unit-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './unit-card.html',
  styleUrl: './unit-card.scss'
})
export class UnitCardComponent {
  @Input() unit!: ShopUnit;
}
