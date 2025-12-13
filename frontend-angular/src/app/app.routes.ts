import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DailyLoginComponent } from './components/daily-login/daily-login.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'daily-login', component: DailyLoginComponent },
  { path: '**', redirectTo: '' }
];
