import psycopg2
from app.core.config import settings

def check_roles():
    try:
        conn = psycopg2.connect(settings.database_url)
        cursor = conn.cursor()
        cursor.execute("SELECT role_nm FROM etl_role")
        roles = cursor.fetchall()
        print("Roles in Postgres DB:")
        for role in roles:
            print(f"- {role[0]}")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error connecting to Postgres: {e}")

if __name__ == "__main__":
    check_roles()
