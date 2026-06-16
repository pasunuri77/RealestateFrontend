import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './shared/public-layout/public-layout';
import { AdminLayoutComponent } from './shared/admin-layout/admin-layout';
import { PublicHomeComponent } from './public/home/home';
import { PublicProjectsComponent } from './public/projects/projects';
import { PublicProjectDetailComponent } from './public/project-detail/project-detail';
import { PublicUnitDetailComponent } from './public/unit-detail/unit-detail';
import { PublicLeaseFormComponent } from './public/lease-form/lease-form';
import { PublicPurchaseFormComponent } from './public/purchase-form/purchase-form';
import { LoginComponent } from './auth/login/login';
import { RegisterComponent } from './auth/register/register';
import { AdminDashboardComponent } from './admin/dashboard/dashboard';
import { AdminProjectsComponent } from './admin/projects/projects';
import { AdminBuildingsComponent } from './admin/buildings/buildings';
import { AdminFloorsComponent } from './admin/floors/floors';
import { AdminShopUnitsComponent } from './admin/shop-units/shop-units';
import { AdminLeaseRequestsComponent } from './admin/lease-requests/lease-requests';
import { AdminPurchaseRequestsComponent } from './admin/purchase-requests/purchase-requests';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Public Routes (Navbar and Footer layout)
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: PublicHomeComponent },
      { path: 'projects', component: PublicProjectsComponent },
      { path: 'projects/:id', component: PublicProjectDetailComponent },
      { path: 'units/:id', component: PublicUnitDetailComponent },
      { path: 'units/:id/lease', component: PublicLeaseFormComponent, canActivate: [authGuard] },
      { path: 'units/:id/purchase', component: PublicPurchaseFormComponent, canActivate: [authGuard] },
      { path: 'purchase-requests', component: AdminPurchaseRequestsComponent, canActivate: [authGuard] },
      { path: 'lease-requests', component: AdminLeaseRequestsComponent, canActivate: [authGuard] },
      { path: 'auth/login', component: LoginComponent },
      { path: 'auth/register', component: RegisterComponent }
    ]
  },

  // Admin Routes (Sidebar Dashboard layout)
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [roleGuard],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'projects', component: AdminProjectsComponent },
      { path: 'buildings', component: AdminBuildingsComponent },
      { path: 'floors', component: AdminFloorsComponent },
      { path: 'shop-units', component: AdminShopUnitsComponent },
      { path: 'lease-requests', component: AdminLeaseRequestsComponent },
      { path: 'purchase-requests', component: AdminPurchaseRequestsComponent }
    ]
  },

  // Fallback
  { path: '**', redirectTo: '' }
];
