import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LicenseService } from '../services/license.service';

/**
 * Guard that requires user to be logged in.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isLoggedIn()) {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

/**
 * Guard that requires user to be an admin.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  
  if (!authService.isAdmin()) {
    router.navigate(['/']);
    return false;
  }
  
  return true;
};

/**
 * Guard that requires user to be admin OR have a valid license.
 * Admin users can access all features without a license.
 * Regular users need a valid license to access protected features.
 */
export const licenseGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const licenseService = inject(LicenseService);
  const router = inject(Router);
  
  // Admin users bypass license check
  if (authService.isAdmin()) {
    return true;
  }
  
  // Check if already has valid license cached
  const cachedStatus = licenseService.hasValidLicense();
  if (cachedStatus === true) {
    return true;
  }
  
  // If not cached or false, check with backend
  const hasLicense = await licenseService.checkLicense();
  
  if (hasLicense) {
    return true;
  }
  
  // No valid license, redirect to license page
  router.navigate(['/license']);
  return false;
};
