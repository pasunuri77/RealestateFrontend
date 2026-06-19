import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss'
})
export class EmptyStateComponent {
  @Input() icon = 'sentiment_dissatisfied';
  @Input() title = 'No results found';
  @Input() message = 'Try adjusting your filters or search terms.';
}
