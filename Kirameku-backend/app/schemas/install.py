from pydantic import BaseModel


class InitRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
