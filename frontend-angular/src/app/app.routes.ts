import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DailyLoginComponent } from './components/daily-login/daily-login.component';
import { DeviceManagerComponent } from './components/device-manager/device-manager.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'devices', component: DeviceManagerComponent },
  { path: 'daily-login', component: DailyLoginComponent },
  { path: '**', redirectTo: '' }
];
