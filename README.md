# MelodyScribe

AI-powered music transcription application that converts audio files into musical notation and sheet music.

## 🎵 Features

- **Audio Upload**: Support for WAV, MP3, FLAC, and OGG formats
- **Pitch Detection**: Advanced algorithms for accurate note recognition
- **Rhythm Analysis**: Onset detection and tempo estimation
- **Key Detection**: Automatic key signature identification
- **Quantization**: Convert continuous audio to discrete musical notes
- **Sheet Music Generation**: Export to standard music notation formats

## 🏗️ Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with automatic API documentation
- **Audio Processing**: Librosa, Aubio, CREPE for pitch detection
- **AI Integration**: Ollama for music analysis and notation
- **File Handling**: Secure audio file uploads with metadata extraction

### Frontend (Planned)
- **Desktop App**: Electron + React + TypeScript
- **UI Components**: Modern interface for audio upload and notation display
- **Real-time Preview**: Live transcription visualization

## 🚀 Current Status

### ✅ Completed
- Backend project structure (P01)
- Pydantic data models (P02)
- Audio service foundation (P03)
- API routes for upload and transcribe (P04-P05, P10)
- Core audio processing modules (P06-P09)
- Basic FastAPI server with health endpoint

### ⚠️ Known Issues
- **Python 3.13 Compatibility**: Some audio libraries (numpy, librosa, pydub) have compilation issues
- **Missing Dependencies**: Audio processing libraries not fully installed
- **Frontend**: Not yet implemented

### 🔄 In Progress
- Resolving dependency conflicts
- Full audio processing pipeline integration

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.11+ (3.13 has compatibility issues with some libraries)
- Virtual environment support

### Backend Setup

1. **Create virtual environment**:
   ```bash
   python -m venv .venv-1
   ```

2. **Activate environment**:
   ```bash
   .venv-1\Scripts\activate  # Windows
   ```

3. **Install dependencies**:
   ```bash
   pip install fastapi uvicorn pydantic python-multipart
   ```

4. **Run the server**:
   ```bash
   python -m uvicorn backend.app.main:app --reload --port 8000
   ```

5. **Verify installation**:
   ```bash
   curl http://localhost:8000/api/health
   # Expected: {"success":true,"data":{"status":"ok"}}
   ```

### API Endpoints

- `GET /api/health` - Server health check
- `POST /api/upload` - Upload audio file
- `POST /api/transcribe` - Transcribe audio to notes

Visit `http://localhost:8000/docs` for interactive API documentation.

## 📁 Project Structure

```
MelodyScribeOk/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI application entry point
│       ├── config.py            # Application configuration
│       ├── models/              # Pydantic data models
│       │   ├── audio.py
│       │   ├── note.py
│       │   └── project.py
│       ├── services/            # Business logic services
│       │   ├── audio_service.py
│       │   └── segmentation_service.py
│       ├── core/                # Core audio processing modules
│       │   ├── pitch_detector.py
│       │   ├── onset_detector.py
│       │   ├── tempo_detector.py
│       │   ├── key_detector.py
│       │   └── quantizer.py
│       └── api/
│           └── routes/          # API endpoint definitions
│               ├── audio.py
│               └── transcribe.py
├── frontend/                    # (Planned) Electron + React app
├── instructions/                # Project documentation
│   ├── 01-ARCHITECTURE.md
│   ├── 02-AI-INSTRUCTIONS.md
│   └── 03-CLINE-PROMPTS.md
├── LICENSE
└── README.md
```

## 🎯 Next Steps

1. **Resolve Dependencies**: Fix Python 3.13 compatibility issues
2. **Install Audio Libraries**: Add librosa, aubio, crepe, music21
3. **Complete Backend**: Implement full transcription pipeline
4. **Frontend Development**: Create Electron + React interface
5. **Integration**: Connect frontend with backend APIs
6. **Testing**: Add comprehensive test suite
7. **Documentation**: Complete API and user documentation

## 🤝 Contributing

This project is in active development. Contributions welcome!

## 📄 License

See LICENSE file for details.
