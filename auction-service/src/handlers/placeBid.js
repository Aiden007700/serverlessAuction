import AWS from "aws-sdk";
import validator from "@middy/validator";
import commonMiddleware from "../lib/commonMiddleware";
import createError from "http-errors";
import { getAuctionById } from "./getAuction";
import placeBidSchema from "../lib/schemas/placeBidSchema";

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function placeBid(event, context) {
  const { id } = event.pathParameters;
  const { email } = event.requestContext.authorizer;
  const { amount } = event.body;
  const auction = await getAuctionById(id);

  if (auction.status !== "OPEN") {
    throw new createError.Forbidden("This Auction is no longer open");
  }

  if (amount <= auction.highestBid.amount) {
    throw new createError.Forbidden(
      `Your bid must be heigher then ${auction.highestBid.amount}`
    );
  }

  if (email === auction.highestBid.bidder) {
    throw new createError.Forbidden(
      `Your alredy have the highest bid`
    );
  }

  if (email === auction.seller) {
    throw new createError.Forbidden(
      `You cant bid on your own item`
    );
  }

  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id },
    UpdateExpression:
      "set highestBid.amount = :amount, highestBid.bidder = :bidder",
    ExpressionAttributeValues: {
      ":amount": amount,
      ":bidder": email,
    },
    ReturnValues: "ALL_NEW",
  };

  let updatedAuction;

  try {
    const result = await dynamoDB.update(params).promise();
    updatedAuction = result.Attributes;
  } catch (error) {
    console.log(error);
    throw new createError.InternalServerError(error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ updatedAuction }),
  };
}

export const handler = commonMiddleware(placeBid).use(
  validator({ inputSchema: placeBidSchema })
);
