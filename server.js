const express = require('express');
const axios = require('axios');
const Load = require('lodash');
const app = express();
const port = 3000; 
let blogData;
let blogStatsCache;
let blogSearchCache = Load.memoize(async (query) => {
 const regex = new RegExp(query, 'i');
if (!blogData) {
    throw new Error('Blog data is not available.');
  }
const matchingBlogs = blogData.filter((blog) => regex.test(blog.title) || regex.test(blog.content));

  if (matchingBlogs.length === 0) {
    return { message: 'No matching blogs found.' };
  }
return { matchingBlogs };
});

const cachedBlogStats = Load.memoize(async () => {
  try {

    const response = await axios.get('https://intent-kit-16.hasura.app/api/rest/blogs', {
      headers: {
        'x-hasura-admin-secret': '32qR4KmXOIpsGPQKMqEJHGJS27G5s7HdSKO3gdtQd2kv5e852SiYwWNfxkZOBuQ6'
      }
    });

    if (!response.data) {
      throw new Error('No blog data found.');
    }

    blogData = response.data.blogs; 
    if (blogData.length === 0) {
      throw new Error('No blogs available for analysis.');
    }
    const totalBlogs = blogData.length;
    const blogWithLongestTitle = Load.maxBy(blogData, (blog) => blog.title.length).title;
    const blogsWithPrivacyTitle = Load.filter(blogData, (blog) =>
      Load.includes(Load.toLower(blog.title), 'privacy')
    );
    const uniqueBlogTitles = Load.uniqBy(blogData, 'title').map((blog) => blog.title);
    blogStatsCache = {
      totalBlogs,
      blogWithLongestTitle,
      numberOfBlogsWithPrivacyTitle: blogsWithPrivacyTitle.length,
      uniqueBlogTitles,
    };

    return blogStatsCache;
  } catch (error) {
    console.error('Error fetching or processing blog data:', error);
    throw error; 
  }
}, () => 'cacheKey'); 
app.get('/api/blog-stats', async (req, res) => {
  try {
    const blogStats = await cachedBlogStats();
    res.json(blogStats);
  } catch (error) {
    console.error('Error handling request:', error);
    if (error.message.includes('No blog data found.')) {
      res.status(404).json({ error: 'No blog data found.' });
    } else if (error.message.includes('No blogs available for analysis.')) {
      res.status(404).json({ error: 'No blogs available for analysis.' });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
});
app.get('/api/blog-search', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter "query" is required.' });
  }

  try {
    const searchResults = await blogSearchCache(query);
    res.json(searchResults);
  } catch (error) {
    console.error('Error handling search request:', error);

    if (error.message.includes('No matching blogs found.')) {
      res.json({ message: 'No matching blogs found.' });
    } else if (error.message.includes('Blog data is not available.')) {
      res.status(500).json({ error: 'Blog data is not available.' });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



