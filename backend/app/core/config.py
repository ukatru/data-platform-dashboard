from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus Control API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    POSTGRES_USER: str = "dagster"
    POSTGRES_PASSWORD: str = "dagster"
    POSTGRES_HOST: str = "192.168.2.116"
    POSTGRES_PORT: str = "30722"
    POSTGRES_DB: str = "dagster_etl_framework"
    
    @property
    def database_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Framework paths
    DAG_FACTORY_SRC: str = "/home/ukatru/github/dagster-dag-factory/src"
    METADATA_FRAMEWORK_SRC: str = "/home/ukatru/github/dagster-metadata-framework/src"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        case_sensitive=True
    )

settings = Settings()
