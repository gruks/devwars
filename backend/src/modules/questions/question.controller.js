/**
 * Question controller
 * HTTP handlers for question endpoints
 */

const { Question } = require('./question.model.js');
const { HTTP_STATUS } = require('../../utils/constants.js');

/**
 * Get questions with filtering and pagination
 * GET /api/v1/questions
 */
const getQuestions = async (req, res) => {
  try {
    const {
      mode = 'debug',
      difficulty,
      language,
      search,
      isActive = 'true',
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Mode filter
    if (mode) filter.mode = mode;

    // Difficulty filter
    if (difficulty) filter.difficulty = difficulty;

    // Language filter
    if (language) filter.language = language;

    // Active status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Search by title or description
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { tags: { $in: [new RegExp(searchTerm, 'i')] } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ difficulty: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-solution -hints') // Don't send solution/hints in list view
        .lean(),
      Question.countDocuments(filter)
    ]);

    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: questions,
      meta: {
        total,
        page: pageNum,
        pages,
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch questions',
      error: error.message
    });
  }
};

/**
 * Get question by ID
 * GET /api/v1/questions/:id
 */
const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findOne({ id })
      .populate('author', 'username');

    if (!question) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch question',
      error: error.message
    });
  }
};

/**
 * Create a new question
 * POST /api/v1/questions
 */
const createQuestion = async (req, res) => {
  try {
    const {
      mode = 'debug',
      title,
      description,
      language,
      difficulty,
      starterCode,
      solution,
      testcases,
      hints = [],
      timeLimit = 300000,
      memoryLimit = 256,
      tags = []
    } = req.body;

    // Validate required fields
    const requiredFields = ['title', 'description', 'language', 'difficulty', 'starterCode', 'solution', 'testcases'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate language
    const validLanguages = ['python', 'javascript', 'java', 'go', 'cpp', 'csharp', 'ruby', 'rust'];
    if (!validLanguages.includes(language)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Invalid language. Must be one of: ${validLanguages.join(', ')}`
      });
    }

    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard', 'extreme'];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`
      });
    }

    // Validate testcases
    if (!Array.isArray(testcases) || testcases.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'At least one test case is required'
      });
    }

    // Validate each testcase
    for (const tc of testcases) {
      if (!tc.input || !tc.output) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Each test case must have input and output'
        });
      }
    }

    const question = await Question.create({
      mode,
      title,
      description,
      language,
      difficulty,
      starterCode,
      solution,
      testcases,
      hints,
      timeLimit,
      memoryLimit,
      tags,
      author: req.user?._id || null,
      isActive: true
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Question created successfully',
      data: question
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create question',
      error: error.message
    });
  }
};

/**
 * Sample debug questions for seeding
 */
const sampleQuestions = [
  // Easy
  {
    mode: 'debug',
    title: 'Fix the Sum Function',
    description: 'There\'s a bug in this simple addition function. Find and fix it!',
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function sum(a, b) {
  return a + b + 1; // Bug: extra +1
}`,
    solution: `function sum(a, b) {
  return a + b;
}`,
    testcases: [
      { input: 'sum(1, 2)', output: '3' },
      { input: 'sum(5, 5)', output: '10' },
      { input: 'sum(-1, 1)', output: '0' }
    ],
    hints: ['Check the return statement carefully', 'Is there an extra operation?'],
    tags: ['basics', 'functions'],
    timeLimit: 120000, // 2 minutes
    memoryLimit: 128
  },
  // Medium 1
  {
    mode: 'debug',
    title: 'Fix Array Filtering',
    description: 'This function should filter even numbers from an array, but it\'s not working correctly.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 1); // Bug: checking odd instead of even
}`,
    solution: `function filterEven(numbers) {
  return numbers.filter(n => n % 2 === 0);
}`,
    testcases: [
      { input: 'filterEven([1, 2, 3, 4, 5, 6])', output: '[2, 4, 6]' },
      { input: 'filterEven([2, 4, 6])', output: '[2, 4, 6]' },
      { input: 'filterEven([1, 3, 5])', output: '[]' }
    ],
    hints: ['Check the modulo condition', 'Should the remainder be 0 or 1 for even numbers?'],
    tags: ['arrays', 'filtering'],
    timeLimit: 180000, // 3 minutes
    memoryLimit: 128
  },
  // Medium 2
  {
    mode: 'debug',
    title: 'Fix Palindrome Check',
    description: 'This function should check if a string is a palindrome, but it has a bug.',
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function isPalindrome(str) {
  const reversed = str.split('').reverse();
  return str === reversed; // Bug: comparing string to array
}`,
    solution: `function isPalindrome(str) {
  const reversed = str.split('').reverse().join('');
  return str === reversed;
}`,
    testcases: [
      { input: "isPalindrome('radar')", output: 'true' },
      { input: "isPalindrome('hello')", output: 'false' },
      { input: "isPalindrome('a')", output: 'true' }
    ],
    hints: ['Check what type split() returns', 'Do you need to convert it back?'],
    tags: ['strings', 'algorithms'],
    timeLimit: 180000, // 3 minutes
    memoryLimit: 128
  },
  // Hard 1
  {
    mode: 'debug',
    title: 'Fix Recursive Fibonacci',
    description: 'This recursive Fibonacci implementation is too slow for larger numbers. Fix the performance issue.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2); // Bug: exponential time complexity
}`,
    solution: `function fibonacci(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}`,
    testcases: [
      { input: 'fibonacci(5)', output: '5' },
      { input: 'fibonacci(10)', output: '55' },
      { input: 'fibonacci(20)', output: '6765' }
    ],
    hints: ['The function recalculates the same values many times', 'Can you store and reuse results?'],
    tags: ['recursion', 'memoization', 'algorithms'],
    timeLimit: 300000, // 5 minutes
    memoryLimit: 256
  },
  // Hard 2
  {
    mode: 'debug',
    title: 'Fix Deep Clone',
    description: 'This deep clone function has issues with circular references and certain data types.',
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const cloned = {};
  for (let key in obj) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned; // Bug: no circular reference handling
}`,
    solution: `function deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (Array.isArray(obj)) {
    const cloned = [];
    seen.set(obj, cloned);
    obj.forEach((item, i) => {
      cloned[i] = deepClone(item, seen);
    });
    return cloned;
  }
  const cloned = {};
  seen.set(obj, cloned);
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key], seen);
    }
  }
  return cloned;
}`,
    testcases: [
      { input: 'deepClone({a: 1, b: {c: 2}})', output: '{a: 1, b: {c: 2}}' },
      { input: 'deepClone([1, [2, 3]])', output: '[1, [2, 3]]' },
      { input: 'deepClone({x: 1})', output: '{x: 1}' }
    ],
    hints: ['What happens with circular references?', 'Consider using a WeakMap to track seen objects'],
    tags: ['objects', 'recursion', 'advanced'],
    timeLimit: 300000, // 5 minutes
    memoryLimit: 256
  }
];

/**
 * Seed questions with sample data
 * POST /api/v1/questions/seed
 */
const seedQuestions = async (req, res) => {
  try {
    // Delete existing debug questions
    await Question.deleteMany({ mode: 'debug' });

    // Insert sample questions
    const questions = await Question.insertMany(sampleQuestions);

    res.json({
      success: true,
      message: `Successfully seeded ${questions.length} debug questions`,
      data: {
        count: questions.length,
        questions: questions.map(q => ({ id: q.id, title: q.title, difficulty: q.difficulty }))
      }
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to seed questions',
      error: error.message
    });
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  seedQuestions
};
