import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

export async function closeAuction(auction) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id: auction.id },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeValues: {
      ":status": "CLOSED",
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  const result = dynamodb.update(params).promise();
  const { title, seller, highestBid } = auction;
  const { amount, bidder } = highestBid;

  if (bidder) {
    const notifySeller = sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "Your item has been sold!",
          body: `Nice ${title} sold for ${amount}`,
          recipient: seller,
        }),
      })
      .promise();

    const notifyBidder = sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "You won an auction",
          body: `Nice you won ${title} for ${amount}`,
          recipient: bidder,
        }),
      })
      .promise();

    return Promise.all([result, notifySeller, notifyBidder]);
  } else {
    const notifySeller = sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: "Your item did not sell :(",
          body: `Looks like ${title} was not sold`,
          recipient: seller,
        }),
      })
      .promise();
    return Promise.all([result, notifySeller]);
  }
}
