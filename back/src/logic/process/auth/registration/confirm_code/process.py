from datetime import datetime, timedelta, timezone

from toolkit.tool.sql_db.tool import SqlDb
from toolkit.tool.user_auth_jwt_manager.tool import UserAuthJwtManager

from system.errors import NotFoundError, ResourceConflictError, ValidationError

from logic.entity.user.entity import User
from logic.entity.person.entity import Person
from logic.entity.user_auth_confirm_code.entity import UserAuthConfirmCode
from logic.service.auth.service import AuthService

from .models import (
    RegistrationStartParams,
    RegistrationStartResult,
    RegistrationFinishParams,
    RegistrationFinishResult,
)


class RegistrationConfirmCode:
    @staticmethod
    async def start(data: RegistrationStartParams) -> RegistrationStartResult:
        print(f"[REG START] Начало регистрации для email: {data.auth_email}")
        db_client: SqlDb = SqlDb.get_from_container("db")

        async with db_client.transaction_manager.transaction() as tx:
            existing_user = await User.get_by_auth_email(data.auth_email, tx=tx)
            if existing_user:
                print(f"[REG START] ❌ Пользователь уже существует: {data.auth_email}")
                raise ResourceConflictError(
                    message="Пользователь с таким email уже существует",
                    error_code="USER_ALREADY_EXISTS",
                )

            print(f"[REG START] ✓ Email свободен, создаём запись подтверждения...")
            auth_record = await AuthService.create_confirm_code_for_registration(
                auth_email=data.auth_email,
                first_name=data.first_name,
                last_name=data.last_name,
                middle_name=data.middle_name,
                tx=tx,
            )
            print(f"[REG START] ✓ Запись создана: token={auth_record.token}, code={auth_record.confirm_code}")

        sending_tx = await db_client.transaction_manager.begin()
        try:
            print(f"[REG START] Отправка кода на email...")
            await auth_record.result_writer.sending_result(is_success=True, tx=sending_tx)
            await auth_record.code_manager.send_to_email()
            await sending_tx.commit()
            print(f"[REG START] ✓ Код успешно отправлен")
        except Exception as e:
            print(f"[REG START] ❌ Ошибка отправки: {e}")
            await sending_tx.rollback()
            await auth_record.refresh_self()
            error_message = e.message if isinstance(e, ValidationError) else str(e)
            await auth_record.result_writer.sending_result(is_success=False, error=error_message)
            raise

        print(f"[REG START] ✓ Завершено успешно, confirmation_token={auth_record.token}")
        return RegistrationStartResult(
            confirmation_token=str(auth_record.token),
            expires_at=auth_record.expires_at,
        )

    @staticmethod
    async def finish(data: RegistrationFinishParams) -> RegistrationFinishResult:
        print(f"[REG FINISH] Начало завершения регистрации, confirmation_token={data.confirmation_token[:8]}...")
        db_client: SqlDb = SqlDb.get_from_container("db")
        jwt_manager: UserAuthJwtManager = UserAuthJwtManager.get_from_container("user_auth_jwt_manager")

        async with db_client.transaction_manager.transaction() as tx:
            auth_record = await UserAuthConfirmCode.get_by_token(data.confirmation_token, tx=tx)
            if not auth_record:
                print(f"[REG FINISH] ❌ Запись подтверждения не найдена")
                raise NotFoundError(
                    message="Запись подтверждения не найдена",
                    error_code="CONFIRM_CODE_NOT_FOUND",
                )

            print(f"[REG FINISH] ✓ Запись найдена: email={auth_record.auth_email}, is_user_created={auth_record.is_user_created}")

            if auth_record.is_user_created:
                print(f"[REG FINISH] ❌ Регистрация уже завершена")
                raise ValidationError(
                    message="Регистрация уже завершена",
                    error_code="REGISTRATION_ALREADY_COMPLETED",
                )

            print(f"[REG FINISH] Проверка кода: received={data.confirm_code}, expected={auth_record.confirm_code}")
            try:
                await auth_record.code_manager.verify_code(data.confirm_code)
                print(f"[REG FINISH] ✓ Код подтверждён")
            except ValidationError as e:
                print(f"[REG FINISH] ❌ Неверный код: {e.message}")
                await auth_record.result_writer.verification_result(
                    is_success=False, error=e.message, tx=tx
                )
                raise

            await auth_record.result_writer.verification_result(is_success=True, tx=tx)

            auth_session_expires_at = datetime.now(timezone.utc) + timedelta(
                days=jwt_manager.config.auth_session_expire_days
            )

            print(f"[REG FINISH] Создание Person: {auth_record.first_name} {auth_record.last_name}")
            person = await Person.create(
                data={
                    "first_name": auth_record.first_name,
                    "last_name": auth_record.last_name,
                    "middle_name": auth_record.middle_name,
                },
                tx=tx,
            )
            print(f"[REG FINISH] ✓ Person создан: id={person.id}")

            print(f"[REG FINISH] Создание User: email={auth_record.auth_email}")
            user = await User.create(
                data={
                    "person_id": person.id,
                    "auth_email": auth_record.auth_email,
                    "has_access": True,
                    "auth_session_expires_at": auth_session_expires_at,
                },
                tx=tx,
            )
            print(f"[REG FINISH] ✓ User создан: id={user.id}")

            await auth_record.result_writer.user_creation_result(
                is_success=True,
                user_id=user.id,
                tx=tx,
            )

        print(f"[REG FINISH] Создание access_token для user_id={user.id}")
        access_token = await jwt_manager.create_access_token(user.id)
        access_token_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=jwt_manager.config.access_token_expire_minutes
        )
        print(f"[REG FINISH] ✓ Access token создан, expires_at={access_token_expires_at}")

        print(f"[REG FINISH] ✓ Регистрация завершена успешно! user_id={user.id}, person_id={person.id}")
        return RegistrationFinishResult(
            verified=True,
            message="Код подтверждения успешно проверен",
            user_id=user.id,
            person_id=person.id,
            access_token=access_token,
            expires_at=access_token_expires_at.isoformat(),
            session_expires_days=jwt_manager.config.auth_session_expire_days,
        )
