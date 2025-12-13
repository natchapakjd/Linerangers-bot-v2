import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DailyLoginComponent } from './components/daily-login/daily-login.component';
import { DeviceManagerComponent } from './components/device-manager/device-manager.component';
import { LicenseComponent } from './components/license/license.component';
import { AdminLicenseComponent } from './components/admin-license/admin-license.component';
import { LoginComponent } from './components/login/login.component';
import { adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'login', component: LoginComponent },
  { path: 'devices', component: DeviceManagerComponent },
  { path: 'daily-login', component: DailyLoginComponent },
  { path: 'license', component: LicenseComponent },
  { path: 'admin/license', component: AdminLicenseComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
