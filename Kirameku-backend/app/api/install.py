"""系统安装 —— 首次运行创建初始管理员

约定：sys_install 表存在一行记录即视为“已初始化”。
未初始化时开放 POST /init 创建初始管理员；初始化后永久关闭。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.deps import get_session
from app.models import User, InstallRecord
from app.schemas.install import InitRequest
from app.utils.auth import hash_password

router = APIRouter(prefix="/api/install", tags=["系统安装"])


def is_installed(session: Session) -> bool:
    """是否存在安装记录"""
    return session.exec(select(InstallRecord).limit(1)).first() is not None


@router.get("/status")
def install_status(session: Session = Depends(get_session)):
    return {
        "code": 0,
        "message": "success",
        "data": {"installed": is_installed(session)},
    }


@router.post("/init")
def install_init(req: InitRequest, session: Session = Depends(get_session)):
    if is_installed(session):
        raise HTTPException(status_code=400, detail="系统已初始化")

    username = req.username.strip()
    nickname = req.nickname.strip()
    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if len(username) < 3 or len(username) > 50:
        raise HTTPException(status_code=400, detail="用户名长度需在 3-50 之间")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少 6 位")

    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    admin = User(
        username=username,
        hashed_password=hash_password(req.password),
        nickname=nickname or username,
        is_admin=True,
    )
    session.add(admin)
    session.add(InstallRecord(installed=True, admin_username=username))
    session.commit()

    return {
        "code": 0,
        "message": "初始化成功",
        "data": {"username": username},
    }
