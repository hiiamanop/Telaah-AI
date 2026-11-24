import unittest
from urllib.parse import quote

from scraper.stockbit import parse_broker_summary, parse_credential_storage

ACCESS = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQwMDAwMDAwMDAsInR5cGUiOiJhY2Nlc3MifQ.signature"
REFRESH = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQwMDAwMDAwMDAsInR5cGUiOiJyZWZyZXNoIn0.signature"


class CredentialStorageTests(unittest.TestCase):
    def test_parses_url_encoded_cookie(self):
        blob = quote(
            '{"state":{"access":{"token":"%s"},"refresh":{"token":"%s"}}}'
            % (ACCESS, REFRESH)
        )
        session = parse_credential_storage(blob)
        self.assertEqual(session.access, ACCESS)
        self.assertEqual(session.refresh, REFRESH)

    def test_accepts_bare_refresh_token(self):
        session = parse_credential_storage(REFRESH)
        self.assertEqual(session.refresh, REFRESH)
        self.assertEqual(session.access, "")

    def test_rejects_garbage(self):
        self.assertIsNone(parse_credential_storage("not-a-session"))


class BrokerSummaryTests(unittest.TestCase):
    def test_maps_buyers_and_sellers(self):
        payload = {
            "data": {
                "from": "2026-11-02",
                "to": "2026-11-06",
                "bandar_detector": {"total_buyer": 2, "total_seller": 2},
                "broker_summary": {
                    "brokers_buy": [
                        {
                            "netbs_broker_code": "KZ",
                            "blot": "10",
                            "bval": "1000000",
                            "freq": "3",
                            "netbs_buy_avg_price": "1000",
                            "type": "Asing",
                        },
                        {
                            "netbs_broker_code": "AK",
                            "blot": "5",
                            "bval": "500000",
                            "freq": "2",
                            "netbs_buy_avg_price": "1000",
                        },
                    ],
                    "brokers_sell": [
                        {
                            "netbs_broker_code": "KZ",
                            "slot": "4",
                            "sval": "400000",
                            "freq": "1",
                            "netbs_sell_avg_price": "1000",
                        },
                        {
                            "netbs_broker_code": "CC",
                            "slot": "6",
                            "sval": "600000",
                            "freq": "2",
                            "netbs_sell_avg_price": "1000",
                        },
                    ],
                },
            }
        }
        result = parse_broker_summary(payload, "BBCA", "2026-11-06")
        self.assertEqual(result["source"], "stockbit")
        self.assertEqual(result["coverage"], "full")
        rows = {row["broker_code"]: row for row in result["data"][0]["summary"]}
        self.assertEqual(rows["KZ"]["blot"], 10)
        self.assertEqual(rows["KZ"]["slot"], 4)
        self.assertEqual(rows["KZ"]["nlot"], 6)
        self.assertEqual(rows["KZ"]["nval"], 600000)
        self.assertEqual(rows["CC"]["nlot"], -6)
        self.assertEqual(result["data"][0]["date"], "2026-11-06")


if __name__ == "__main__":
    unittest.main()
