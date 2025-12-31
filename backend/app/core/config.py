from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus Control API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_USER: str = "dagster"
    POSTGRES_PASSWORD: str = "dagster"
    POSTGRES_HOST: str = "192.168.2.116"
    POSTGRES_PORT: str = "30722"
    POSTGRES_DB: str = "dpe_framework"
    
    @property
    def database_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Framework paths
    DAG_FACTORY_SRC: str = "/home/ukatru/github/dagster-dag-factory/src"
    METADATA_FRAMEWORK_SRC: str = "/home/ukatru/github/dagster-metadata-framework/src"
    
    # Security
    SECRET_KEY: str = "7a4e69d95c1c4f4b9d0b8d5e8f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8" # Should be set in .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8 # 8 hours
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        case_sensitive=True
    )

settings = Settings()
