import asyncio
from collections.abc import Mapping
from typing import Any

import httpx
from httpx import ASGITransport, AsyncClient, Response


class ApiTestClient:
    def __init__(self, app):
        self.app = app
        self.cookies = httpx.Cookies()
        self.base_url = "http://testserver"

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: Mapping[str, str] | None = None,
        json: Any = None,
    ) -> Response:
        async def _request() -> Response:
            transport = ASGITransport(app=self.app)
            async with AsyncClient(
                transport=transport,
                base_url=self.base_url,
                cookies=self.cookies,
            ) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json,
                )
            return response

        response = asyncio.run(_request())
        self.cookies.update(response.cookies)
        return response

    def get(self, url: str, **kwargs) -> Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> Response:
        return self.request("POST", url, **kwargs)

    def options(self, url: str, **kwargs) -> Response:
        return self.request("OPTIONS", url, **kwargs)
