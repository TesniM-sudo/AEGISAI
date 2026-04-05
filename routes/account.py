from fastapi import APIRouter

router = APIRouter(prefix="/account", tags=["Account"])

@router.post("/login")
def login():
    return {"message": "Login working"}

@router.post("/register")
def register():
    return {"message": "Register endpoint working"}