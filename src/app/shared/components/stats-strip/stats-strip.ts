import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-strip.html',
  styleUrl: './stats-strip.scss'
})
export class StatsStripComponent {
  @Input() completedProjects = 0;
  @Input() ongoingProjects = 0;
  @Input() totalBuildings = 0;
  @Input() availableUnits = 0;
  @Input() upcomingProjects = 0;

  get hasStats(): boolean {
    return this.completedProjects > 0 || 
           this.ongoingProjects > 0 || 
           this.totalBuildings > 0 || 
           this.availableUnits > 0 || 
           this.upcomingProjects > 0;
  }
}
