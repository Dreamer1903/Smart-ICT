"""Общие тестовые данные: лицевые счета 1С и долги (используются симулятором и seed.py)."""

ACCOUNT_PREFIX = "LS-"


def account_for(index: int) -> str:
    return f"{ACCOUNT_PREFIX}{index:04d}"


# Ученики (по порядковому номеру в seed) с задолженностью, сумма в UZS
SEED_DEBTS: dict[int, float] = {3: 1_200_000.0, 14: 850_000.0, 19: 2_400_000.0}
