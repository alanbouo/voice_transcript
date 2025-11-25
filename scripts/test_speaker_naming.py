import sys
import os
from pathlib import Path
import json

# Add parent directory to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from api.database import init_db, SessionLocal, User, Transcript, SpeakerMapping

def test_speaker_naming():
    # Initialize DB
    init_db()
    db = SessionLocal()
    
    try:
        # Create a dummy user
        user = db.query(User).filter(User.username == "test_speaker_user").first()
        if not user:
            user = User(username="test_speaker_user", hashed_password="hashed_password")
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {user.username}")
        
        # Create a dummy transcript with JSON content
        json_content = json.dumps({
            "utterances": [
                {"speaker": "A", "text": "Hello", "start": 1000, "end": 2000},
                {"speaker": "B", "text": "Hi there", "start": 2000, "end": 3000}
            ]
        })
        
        transcript = Transcript(
            transcript_id="test_transcript_id",
            user_id=user.id,
            filename="test_audio.mp3",
            text_content="A: Hello\nB: Hi there",
            json_content=json_content
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)
        print(f"Created transcript: {transcript.id}")
        
        # Test adding a speaker mapping directly
        mapping = SpeakerMapping(
            transcript_id=transcript.id,
            original_label="A",
            display_name="Alice"
        )
        db.add(mapping)
        db.commit()
        print("Added speaker mapping for A -> Alice")
        
        # Verify mapping
        saved_mapping = db.query(SpeakerMapping).filter(
            SpeakerMapping.transcript_id == transcript.id,
            SpeakerMapping.original_label == "A"
        ).first()
        
        assert saved_mapping is not None
        assert saved_mapping.display_name == "Alice"
        print("Verified mapping persistence")
        
        # Clean up
        db.delete(saved_mapping)
        db.delete(transcript)
        # Don't delete user to avoid foreign key issues if other tests run, or just leave it
        db.commit()
        print("Test passed successfully!")
        
    except Exception as e:
        print(f"Test failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    test_speaker_naming()
