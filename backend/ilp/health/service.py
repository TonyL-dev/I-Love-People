from ilp.health.repository import HealthRepository


class HealthService:
    def __init__(self, repository: HealthRepository) -> None:
        self._repository = repository

    def is_ready(self) -> bool:
        try:
            return self._repository.can_connect()
        except Exception:
            # Connection exceptions can embed credentials. Return a generic outcome without logging.
            return False
