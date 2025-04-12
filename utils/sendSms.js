const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
require('dotenv').config();

// Set up the SNS client
const snsClient = new SNSClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_Access_Key_Id,
        secretAccessKey: process.env.AWS_Secret_Access_Key,
    },
});


const sendSms = async (otpCode, phoneNo) => {
    try {
        const params = {
            Message: `${otpCode}`, // SMS content
            PhoneNumber: phoneNo, // recipient's phone number (including country code)
            MessageAttributes: {
                'AWS.SNS.SMS.SenderID': {
                    DataType: 'String',
                    StringValue: 'MyApp',
                },
                'AWS.SNS.SMS.SMSType': {
                    DataType: 'String',
                    StringValue: 'Transactional',
                },
            },
        };

        const command = new PublishCommand(params);
        const response = await snsClient.send(command);
        console.log(response,'response-sms')
        if (response.$metadata.httpStatusCode == 200) {
            console.log('SMS sent successfully:', response);
        } else throw new Error('Sms not Sent') 
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};
module.exports = sendSms
