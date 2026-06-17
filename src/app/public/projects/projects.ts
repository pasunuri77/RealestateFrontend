import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-public-projects',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class PublicProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private cdr = inject(ChangeDetectorRef);
  
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  selectedStatus: string = 'All';
  isLoading = true;

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.filteredProjects = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  filterStatus(status: string) {
    this.selectedStatus = status;
    if (status === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(p => p.status?.toUpperCase() === status.toUpperCase());
    }
    this.cdr.detectChanges();
  }
}
