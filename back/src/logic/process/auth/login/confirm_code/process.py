from datetime import datetime, timedelta, timezone

from logic.entity.user.entity import User
from logic.entity.user_auth_confirm_code.entity import UserAuthConfirmCode
from logic.service.auth.service import AuthService
from system.errors import NotFoundError, ValidationError
from toolkit.tool.user_auth_jwt_manager.tool import UserAuthJwtManager
from toolkit.tool.sql_db.tool import SqlDb

from .models import (
    LoginStartParams,
    LoginStartResult,
    LoginFinishParams,
    LoginFinishResult,
)


class LoginConfirmCode:
    @staticmethod
    async def start(data: LoginStartParams) -> LoginStartResult:
        db_client: SqlDb = SqlDb.get_from_container("db")

        auth_email = str(data.auth_email).strip().lower()

        async with db_client.transaction_manager.transaction() as tx:
            existing_user = await User.get_by_auth_email(auth_email, tx=tx)
            if not existing_user:
                raise NotFoundError(
                    message="Пользователь с таким email не найден",
                    error_code="USER_NOT_FOUND",
                )

            if not existing_user.has_access:
                raise ValidationError(
                    message="Доступ пользователя заблокирован",
                    error_code="USER_ACCESS_DENIED",
                )

            auth_record = await AuthService.create_confirm_code_for_login(
                auth_email=auth_email,
                user_id=existing_user.id,
                tx=tx,
            )

        sending_tx = await db_client.transaction_manager.begin()
        try:
            await auth_record.result_writer.sending_result(is_success=True, tx=sending_tx)
            await auth_record.code_manager.send_to_email()
            await sending_tx.commit()
        except Exception as e:
            await sending_tx.rollback()
            await auth_record.refresh_self()
            error_message = e.message if hasattr(e, 'message') else str(e)
            await auth_record.result_writer.sending_result(is_success=False, error=error_message)
            raise

        return LoginStartResult(
            confirmation_token=str(auth_record.token),
            expires_at=auth_record.expires_at,
        )

    @staticmethod
    async def finish(data: LoginFinishParams) -> LoginFinishResult:
        db_client: SqlDb = SqlDb.get_from_container("db")
        jwt_manager: UserAuthJwtManager = UserAuthJwtManager.get_from_container("user_auth_jwt_manager")

        async with db_client.transaction_manager.transaction() as tx:
            auth_record = await UserAuthConfirmCode.get_by_token(data.confirmation_token, tx=tx)
            if not auth_record:
                raise NotFoundError(
                    message="Запись подтверждения не найдена",
                    error_code="CONFIRM_CODE_NOT_FOUND",
                )

            if auth_record.is_verified:
                raise ValidationError(
                    message="Вход уже выполнен",
                    error_code="LOGIN_ALREADY_COMPLETED",
                )

            try:
                await auth_record.code_manager.verify_code(data.confirm_code)
            except ValidationError as e:
                await auth_record.result_writer.verification_result(
                    is_success=False, error=e.message, tx=tx
                )
                raise

            await auth_record.result_writer.verification_result(is_success=True, tx=tx)

            user = await User.get_by_auth_email(auth_record.auth_email, tx=tx)
            if not user:
                raise NotFoundError(
                    message="Пользователь не найден",
                    error_code="USER_NOT_FOUND",
                )

            if not user.person_id:
                raise NotFoundError(
                    message="Персона не найдена",
                    error_code="PERSON_NOT_FOUND",
                )

            new_expires_at = datetime.now(timezone.utc) + timedelta(days=jwt_manager.config.auth_session_expire_days)
            await user.update_self(tx=tx, auth_session_expires_at=new_expires_at)

        access_token = await jwt_manager.create_access_token(user.id)
        access_token_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=jwt_manager.config.access_token_expire_minutes
        )

        return LoginFinishResult(
            verified=True,
            message="Код подтверждения успешно проверен",
            user_id=user.id,
            person_id=user.person_id,
            access_token=access_token,
            expires_at=access_token_expires_at.isoformat(),
            session_expires_days=jwt_manager.config.auth_session_expire_days,
        )
