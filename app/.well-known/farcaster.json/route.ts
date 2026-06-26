import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {

    // {
    "accountAssociation": {
      "header": "eyJmaWQiOjI0OTcwMiwidHlwZSI6ImF1dGgiLCJrZXkiOiIweGU2Q2ZkQWY3NGJGRUMwMEZhZmRFOTcyNEE0NmNiMDUyNTQ4Qzg0ODgifQ",
      "payload": "eyJkb21haW4iOiJ0YXNrcGF5LWV0YS52ZXJjZWwuYXBwIn0",
      "signature": "/LNkiTWXFYgyW3R33CX7j33CMWNJCyqbbR5aXH0JVxEoG8u74agib24qtG1VEPORy29CWlchsewzoi4EIBy0shs="
    }
    // }
    ,
    // TODO: Add your own account association
    frame: {
      version: "1",
      name: "TaskPay",
      description: "Complete quests, Get paid",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: ["arbitrum", "farcaster", "miniapp", "social"],
      primaryCategory: "social",
      buttonTitle: "Get paid",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
