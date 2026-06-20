const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const applicationsCollection = database.collection("applications");
        const planCollection = database.collection('plans');
        const subscriptionCollection = database.collection('subscriptions');

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

        app.get('/api/jobs/:id', async (req, res) => {
            const id = req.params.id;
            console.log('id', id);
            const query = {
                _id: new ObjectId(id)
            };
            const result = await jobsCollection.findOne(query);
            console.log('result', result);
            res.send(result);
        });

        app.get('/api/companies', async (req, res) => {
            const cursor = companiesCollection.find();
            const companies = await cursor.toArray();

            for (const company of companies) {
                const filter = {
                    companyId: company._id.toString()
                }
                const jobCount = await jobsCollection.countDocuments(filter)
                company.jobCount = jobCount
            }

            res.send(companies);
        })

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
        });

        app.patch('/api/companies/:id', async (req, res) => {
            const id = req.params.id;
            const updatedCompany = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: updatedCompany.status
                }
            }
            const result = await companiesCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });



        app.post('/api/jobs', async (req, res) => {
            const job = req.body;
            const newJob = {
                ...job,
                createdAt: new Date(),
            }
            const result = await jobsCollection.insertOne(newJob);
            res.send(result);
        });

        app.post('/api/applications', async (req, res) => {
            const application = req.body;
            const newApplication = {
                ...application,
                createdAt: new Date()
            }
            const result = await applicationsCollection.insertOne(newApplication);
            res.send(result);
        });

        app.get('/api/applications', async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;
            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }
            const cursor = applicationsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // plans 
        app.get('/api/plans', async (req, res) => {
            const query = {}
            if (req.query.plan_id) {
                query.id = req.query.plan_id
            }
            const plan = await planCollection.findOne(query);
            res.send(plan)
        });

        // subscription 
        app.post('/api/subscriptions', async (req, res) => {
            const data = req.body;
            const subsInfo = {
                ...data,
                createdAt: new Date()
            }

            const result = await subscriptionCollection.insertOne(subsInfo);

            // update the user plan information
            const filter = { email: data.email };
            // update the value of the 'quantity' field to 5
            const updateDocument = {
                $set: {
                    plan: data.planId,
                },
            };

            const updateResult = await usersCollection.updateOne(filter, updateDocument);
            res.send(updateResult)
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