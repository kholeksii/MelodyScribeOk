from fastapi import FastAPI

app = FastAPI(title="MelodyScribe Backend", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "MelodyScribe Backend API"}