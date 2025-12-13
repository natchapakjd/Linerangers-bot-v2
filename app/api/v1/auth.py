"""
Authentication API endpoints.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.services.auth_service import (
    get_auth_service, 
    create_access_token, 
    require_user,
    require_admin
)
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


# ===== Request/Response Models =====

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None


# ===== Endpoints =====

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    New users get 'user' role by default.
    """
    if len(request.password) < 4:
        return AuthResponse(
            success=False,
            message="Password must be at least 4 characters"
        )
    
    service = get_auth_service()
    success, message, user = await service.create_user(
        username=request.username,
        password=request.password,
        email=request.email
    )
    
    if not success:
        return AuthResponse(success=False, message=message)
    
    # Auto-login after registration
    token = create_access_token({"sub": str(user.id), "role": user.role})
    
    return AuthResponse(
        success=True,
        message="Registration successful",
        token=token,
        user=user.to_dict()
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Login with username and password.
    Returns JWT token on success.
    """
    service = get_auth_service()
    success, message, user = await service.authenticate(
        request.username,
        request.password
    )
    
    if not success:
        return AuthResponse(success=False, message=message)
    
    # Create JWT token
    token = create_access_token({"sub": str(user.id), "role": user.role})
    
    return AuthResponse(
        success=True,
        message=f"Welcome back, {user.username}!",
        token=token,
        user=user.to_dict()
    )


@router.get("/me")
async def get_current_user_profile(user: User = Depends(require_user)):
    """
    Get current user profile.
    Requires authentication.
    """
    return {
        "success": True,
        "user": user.to_dict()
    }


@router.get("/check")
async def check_auth_status(user: Optional[User] = Depends(require_user)):
    """
    Check if user is authenticated.
    """
    return {
        "authenticated": user is not None,
        "is_admin": user.is_admin if user else False,
        "user": user.to_dict() if user else None
    }
