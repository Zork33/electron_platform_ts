from logic.entity.user.entity import User
from logic.entity.person.entity import Person


class UserService:

    @staticmethod
    async def get_info(user: User, tx=None) -> dict:
        result = {
            "user_id": user.id,
            "auth_email": user.auth_email,
            "auth_telegram_id": user.auth_telegram_id,
            "has_access": user.has_access,
            "auth_session_expires_at": user.auth_session_expires_at,
            "is_admin": user.is_admin,
            "person": None,
        }

        if user.person_id:
            person = await Person.get(user.person_id, tx=tx)
            if person:
                result["person"] = {
                    "person_id": person.id,
                    "first_name": person.first_name,
                    "last_name": person.last_name,
                    "middle_name": person.middle_name,
                    "birth_date": person.birth_date,
                }

        return result
