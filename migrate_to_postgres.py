#!/usr/bin/env python3
"""
Migration script to move data from SQLite to PostgreSQL

Usage:
    python migrate_to_postgres.py postgresql://user:pass@host:5432/dbname
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from api.database import User, Base
from datetime import datetime


def migrate_database(target_url: str):
    """
    Migrate data from SQLite to PostgreSQL
    
    Args:
        target_url: PostgreSQL connection URL
    """
    
    # Check if SQLite database exists
    sqlite_path = Path("voice_transcript.db")
    if not sqlite_path.exists():
        print("❌ SQLite database not found at:", sqlite_path)
        print("   Nothing to migrate.")
        return
    
    print("🔄 Starting migration from SQLite to PostgreSQL...")
    print()
    
    # Fix PostgreSQL URL if needed
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)
    
    # Connect to SQLite (source)
    print("📂 Connecting to SQLite database...")
    sqlite_engine = create_engine(f"sqlite:///{sqlite_path}")
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_session = SqliteSession()
    
    # Connect to PostgreSQL (target)
    print("🐘 Connecting to PostgreSQL database...")
    try:
        postgres_engine = create_engine(target_url)
        PostgresSession = sessionmaker(bind=postgres_engine)
        postgres_session = PostgresSession()
    except Exception as e:
        print(f"❌ Failed to connect to PostgreSQL: {e}")
        return
    
    # Create tables in PostgreSQL
    print("🏗️  Creating tables in PostgreSQL...")
    Base.metadata.create_all(postgres_engine)
    
    # Migrate users
    print("👥 Migrating users...")
    sqlite_users = sqlite_session.query(User).all()
    
    if not sqlite_users:
        print("   No users found in SQLite database.")
    else:
        migrated_count = 0
        skipped_count = 0
        
        for user in sqlite_users:
            # Check if user already exists in PostgreSQL
            existing_user = postgres_session.query(User).filter(
                User.username == user.username
            ).first()
            
            if existing_user:
                print(f"   ⏭️  Skipping existing user: {user.username}")
                skipped_count += 1
                continue
            
            # Create new user in PostgreSQL
            new_user = User(
                username=user.username,
                email=user.email,
                hashed_password=user.hashed_password,
                created_at=user.created_at,
                is_active=user.is_active
            )
            
            postgres_session.add(new_user)
            print(f"   ✅ Migrated user: {user.username}")
            migrated_count += 1
        
        # Commit all changes
        try:
            postgres_session.commit()
            print()
            print(f"✅ Migration completed successfully!")
            print(f"   - Migrated: {migrated_count} users")
            print(f"   - Skipped: {skipped_count} users (already exist)")
        except Exception as e:
            postgres_session.rollback()
            print(f"❌ Error during commit: {e}")
            return
    
    # Close connections
    sqlite_session.close()
    postgres_session.close()
    
    print()
    print("🎉 All done!")
    print()
    print("Next steps:")
    print("1. Set DATABASE_URL in your .env file:")
    print(f"   DATABASE_URL={target_url}")
    print("2. Restart your application")
    print("3. Verify everything works correctly")
    print("4. (Optional) Backup and remove the SQLite database")


def main():
    if len(sys.argv) < 2:
        print("Usage: python migrate_to_postgres.py <postgresql_url>")
        print()
        print("Example:")
        print("  python migrate_to_postgres.py postgresql://user:pass@localhost:5432/voicedb")
        print()
        print("Get your PostgreSQL URL from:")
        print("  - Coolify database settings")
        print("  - Your database provider")
        print("  - Local PostgreSQL installation")
        sys.exit(1)
    
    postgres_url = sys.argv[1]
    
    # Validate URL
    if not postgres_url.startswith(("postgresql://", "postgres://")):
        print("❌ Invalid PostgreSQL URL")
        print("   URL should start with postgresql:// or postgres://")
        sys.exit(1)
    
    # Confirm migration
    print("⚠️  WARNING: This will migrate data from SQLite to PostgreSQL")
    print()
    print("Source: voice_transcript.db (SQLite)")
    print(f"Target: {postgres_url}")
    print()
    response = input("Continue? [y/N]: ")
    
    if response.lower() != 'y':
        print("Migration cancelled.")
        sys.exit(0)
    
    print()
    migrate_database(postgres_url)


if __name__ == "__main__":
    main()
