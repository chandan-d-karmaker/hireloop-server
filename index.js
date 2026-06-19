const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = 8080

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!')
})

const uri = process.env.MONGO_DB_URI;;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("hireloop_db");
        const jobsCollection = database.collection("jobs");
        const companiesCollection = database.collection("companies");
        const usersCollection = database.collection("user");

        app.get('/api/users', async (req, res) => {
            const cursor = usersCollection.find().skip(2);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/api/jobs', async (req, res) => {
            const query = {};

            // Extract all possible query parameters from the request
            const {
                companyId,
                status,
                search,
                category,
                jobType,
                workModel
            } = req.query;

            // 1. Existing filters
            if (companyId) {
                query.companyId = companyId;
            }
            if (status) {
                query.status = status;
            }

            // 2. Search by Title or Company Name (using MongoDB $regex for partial match)
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { companyName: { $regex: search, $options: 'i' } }
                ];
            }

            // 3. Filter by Category (matches your DB "category" field)
            if (category && category !== 'all') {
                query.category = category;
            }

            // 4. Filter by Job Type (matches your DB "jobType" field)
            if (jobType && jobType !== 'all') {
                query.jobType = jobType;
            }

            // 5. Filter by Work Model (Remote vs On-site) (matches your DB "isRemote" boolean field)
            if (workModel) {
                if (workModel === 'remote') {
                    query.isRemote = true; // looks for "isRemote": true
                } else if (workModel === 'onsite') {
                    query.isRemote = false; // looks for "isRemote": false
                }
            }

            // Execute the query
            const cursor = jobsCollection.find(query);
            const jobs = await cursor.toArray();
            res.send(jobs);
        });

        app.get('/api/feat-jobs', async (req, res) => {
            const cursor = jobsCollection.find().limit(6);
            const result = await cursor.toArray();
            res.send(result);
        });

        // app.get('/api/all-jobs', async (req, res) => {
        //     const cursor = jobsCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // });

        app.get('/api/companies', async (req, res) => {
            const cursor = companiesCollection.find().skip(2);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/api/my/companies', async (req, res) => {
            const query = {};
            if (req.query.addedBy) {
                query.addedBy = req.query.addedBy;
            }
            const result = await companiesCollection.findOne(query);
            res.send(result || {});
        });

        app.post('/api/companies', async (req, res) => {
            const company = req.body;
            const newCompany = {
                ...company,
                createdAt: new Date(),
            }
            const result = await companiesCollection.insertOne(newCompany);
            res.send(result);
        })


        app.post('/api/jobs', async (req, res) => {
            const job = req.body;
            const newJob = {
                ...job,
                createdAt: new Date(),
            }
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})