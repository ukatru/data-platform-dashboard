from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class SecretProvider:
    """
    Base class for secret management providers.
    """
    def store_secret(self, key: str, value: str) -> str:
        raise NotImplementedError

    def get_secret(self, key: str) -> str:
        raise NotImplementedError

class AWSSecretsManagerProvider(SecretProvider):
    """
    Dummy AWS Secrets Manager provider for now.
    """
    def __init__(self):
        self._secrets = {}

    def store_secret(self, key: str, value: str) -> str:
        logger.info(f"[DUMMY] Storing secret in AWS Secrets Manager: {key}")
        self._secrets[key] = value
        return f"arn:aws:secretsmanager:us-east-1:123456789012:secret:{key}"

    def get_secret(self, key: str) -> str:
        logger.info(f"[DUMMY] Fetching secret from AWS Secrets Manager: {key}")
        return self._secrets.get(key, "******")

# Global instance
secret_provider = AWSSecretsManagerProvider()

SENSITIVE_KEYWORDS = ["password", "key", "token", "secret", "access_key", "secret_key"]

def is_sensitive(field_name: str) -> bool:
    """Check if a field name suggests it contains sensitive data."""
    fn = field_name.lower()
    return any(k in fn for k in SENSITIVE_KEYWORDS)

def process_secrets_on_save(conn_nm: str, config_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Identify sensitive fields in config_json, store them in the secret provider,
    and replace them with a masked placeholder in the DB.
    """
    processed_config = config_json.copy()
    for key, value in config_json.items():
        if is_sensitive(key) and value and value != "******":
            # Generate a unique secret path
            secret_key = f"nexus/connections/{conn_nm}/{key}"
            secret_provider.store_secret(secret_key, value)
            processed_config[key] = "******" # Masked placeholder
    return processed_config

def mask_secrets_on_retrieval(config_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure all sensitive fields are masked before sending to the frontend.
    """
    masked_config = config_json.copy()
    for key in config_json:
        if is_sensitive(key):
            masked_config[key] = "******"
    return masked_config

def resolve_secrets(conn_nm: str, config_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolve masked values in config_json by fetching them from the secret provider.
    """
    resolved_config = config_json.copy()
    for key, value in config_json.items():
        if is_sensitive(key) and value == "******":
            secret_key = f"nexus/connections/{conn_nm}/{key}"
            resolved_config[key] = secret_provider.get_secret(secret_key)
    return resolved_config
