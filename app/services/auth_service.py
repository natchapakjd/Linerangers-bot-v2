"""
Authentication Service - Handles user authentication, JWT tokens, and authorization.
"""
from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import JWTError, jwt
import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger

from app.core.database import async_session_maker
from app.models.user import User, UserRole


# Security configuration
SECRET_KEY = "lrg-bot-secret-key-change-in-production-2024"  # TODO: Move to environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week

# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def get_password_hash(password: str) -> str:
    """Hash a password."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


class AuthService:
    """Authentication service for user management."""
    
    async def create_user(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        role: str = UserRole.USER
    ) -> Tuple[bool, str, Optional[User]]:
        """
        Create a new user.
        
        Returns:
            Tuple of (success, message, user)
        """
        async with async_session_maker() as session:
            # Check if username exists
            result = await session.execute(
                select(User).where(User.username == username)
            )
            if result.scalar_one_or_none():
                return False, "Username already exists", None
            
            # Check if email exists (if provided)
            if email:
                result = await session.execute(
                    select(User).where(User.email == email)
                )
                if result.scalar_one_or_none():
                    return False, "Email already exists", None
            
            # Create user
            new_user = User(
                username=username,
                email=email,
                hashed_password=get_password_hash(password),
                role=role,
                is_active=True
            )
            
            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)
            
            logger.info(f"Created user: {username} (role: {role})")
            return True, "User created successfully", new_user
    
    async def authenticate(
        self,
        username: str,
        password: str
    ) -> Tuple[bool, str, Optional[User]]:
        """
        Authenticate a user.
        
        Returns:
            Tuple of (success, message, user)
        """
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.username == username)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                return False, "Invalid username or password", None
            
            if not user.is_active:
                return False, "Account is disabled", None
            
            if not verify_password(password, user.hashed_password):
                return False, "Invalid username or password", None
            
            return True, "Login successful", user
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.username == username)
            )
            return result.scalar_one_or_none()
    
    async def ensure_admin_exists(self) -> None:
        """Ensure at least one admin user exists. Create default if not."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).where(User.role == UserRole.ADMIN)
            )
            if not result.scalar_one_or_none():
                # Create default admin
                logger.warning("No admin found, creating default admin user...")
                await self.create_user(
                    username="admin",
                    password="admin123",
                    role=UserRole.ADMIN
                )
                logger.warning("⚠️ Default admin created: admin / admin123")
                logger.warning("⚠️ Please change the password immediately!")


# Singleton instance
_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get or create auth service instance."""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service


# ===== FastAPI Dependencies =====

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """
    FastAPI dependency to get current user from JWT token.
    Returns None if no token or invalid token.
    """
    if not credentials:
        return None
    
    payload = verify_token(credentials.credentials)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    service = get_auth_service()
    return await service.get_user_by_id(int(user_id))


async def require_user(
    user: Optional[User] = Depends(get_current_user)
) -> User:
    """FastAPI dependency to require authenticated user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    return user


async def require_admin(
    user: User = Depends(require_user)
) -> User:
    """FastAPI dependency to require admin role."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user
