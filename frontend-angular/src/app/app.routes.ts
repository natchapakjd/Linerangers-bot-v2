import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DailyLoginComponent } from './components/daily-login/daily-login.component';
import { DeviceManagerComponent } from './components/device-manager/device-manager.component';
import { LicenseComponent } from './components/license/license.component';
import { AdminLicenseComponent } from './components/admin-license/admin-license.component';
import { LoginComponent } from './components/login/login.component';
import { SettingsComponent } from './components/settings/settings.component';
import { WorkflowBuilderComponent } from './components/workflow-builder/workflow-builder.component';
import { TemplateSetManagerComponent } from './components/template-set-manager/template-set-manager.component';
import { ModeConfigurationComponent } from './components/mode-configuration/mode-configuration.component';
import { adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'login', component: LoginComponent },
  { path: 'devices', component: DeviceManagerComponent },
  { path: 'daily-login', component: DailyLoginComponent },
  { path: 'license', component: LicenseComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'workflow-builder', component: WorkflowBuilderComponent },
  { path: 'template-sets', component: TemplateSetManagerComponent },
  { path: 'mode-config', component: ModeConfigurationComponent },
  { path: 'admin/license', component: AdminLicenseComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];

