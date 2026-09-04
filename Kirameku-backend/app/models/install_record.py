from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class InstallRecord(SQLModel, table=True):
    """系统安装记录 —— 存在一行即表示系统已完成初始化"""

    __tablename__ = "sys_install"

    id: Optional[int] = Field(default=None, primary_key=True)
    installed: bool = Field(default=True)
    admin_username: str = Field(default="", max_length=50)
    installed_at: datetime = Field(default_factory=datetime.now)
