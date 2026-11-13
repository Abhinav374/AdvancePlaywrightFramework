import{test,expect} from '@playwright/test'

//ping request
//ping request help you to test if the server is up
//Client  server to check if all is well.
//HTTP GET -> https://restful-booker.herokuapp.com/ping

test('ping request -GET',async({request})=>{
    const responseData= await request.get("https://restful-booker.herokuapp.com/ping");
    console.log(responseData);
    expect(responseData.status()).toBe(201)
})