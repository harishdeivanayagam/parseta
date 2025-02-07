import { NextResponse, NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { Environment, EventName, Paddle } from "@paddle/paddle-node-sdk"
import { Plan } from "@prisma/client"


export async function POST(request: NextRequest) {
    try {
        // Get the raw request body
        const rawBody = await request.text()
        const signature = request.headers.get("paddle-signature")

        if (!signature) {
            return NextResponse.json(
                { error: "No signature provided" },
                { status: 401 }
            )
        }

        const secret = process.env.PADDLE_WEBHOOK_SECRET

        if (!secret) {
            return NextResponse.json(
                { error: "No secret provided" },
                { status: 500 }
            )
        }

        const paddle = new Paddle(process.env.PADDLE_API_KEY || "", {
            environment: process.env.PADDLE_MODE === "production" ? Environment.production : Environment.sandbox
        })

        const event = await paddle.webhooks.unmarshal(rawBody, secret, signature)

        const planData = {
            [process.env.PADDLE_PRICE_PRO || "PRO"]: "PRO",
            [process.env.PADDLE_PRICE_ENT || "ENTERPRISE"]: "ENTERPRISE"
        }

        if (!event) {
            return NextResponse.json(
                { error: "Invalid event" },
                { status: 400 }
            )
        }

        if (event && (event.eventType === EventName.TransactionCompleted)) {
            const customerId = event.data.customerId || ""
            const planId = event.data.items[0].price?.id || ""

            const billing = await prisma.billing.findFirstOrThrow({
                where: {
                    thirdPartyId: customerId
                }
            })

            if (billing.subscriptionId && billing.subscriptionId !== event.data.subscriptionId) {
                await paddle.subscriptions.cancel(billing.subscriptionId, { effectiveFrom: "immediately" })
            }

            await prisma.billing.update({
                where: {
                    organizationId: billing.organizationId
                },
                data: {
                    plan: planData[planId || ""] as Plan,
                    subscriptionId: event.data.subscriptionId,
                    expiresAt: new Date(event.data.billingPeriod?.endsAt || "")
                }
            })
        }

        if (event && (event.eventType === EventName.SubscriptionCanceled || event.eventType === EventName.SubscriptionPastDue)) {
            const customerId = event.data.customerId
            const planId = event.data.items[0].price?.id

            await prisma.billing.updateMany({
                where: {
                    thirdPartyId: customerId
                },
                data: {
                    plan: "FREE",
                    subscriptionId: planId,
                }
            })
        }

        return NextResponse.json("ok")

    } catch (error) {
        console.error("Webhook error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}