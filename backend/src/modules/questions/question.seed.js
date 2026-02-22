/**
 * Question Seed Script - LeetCode Style Questions
 * Run: node src/modules/questions/question.seed.js
 * 
 * Test Case Format: Named parameters like "nums = [2,7,11,15]\ntarget = 9"
 * Output Format: JSON stringified result (e.g., "[0,1]")
 * 
 * Custom Test Cases: Users can add their own test cases via API
 * - POST /api/v1/questions/:id/test-cases (requires auth)
 * - Custom test cases are stored in question.customTestcases array
 * - Each custom test case has: userId, input, output, isHidden, description, timestamps
 */

const mongoose = require('mongoose');
const { Question } = require('./question.model.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devwars';

const leetcodeQuestions = [
  // ========================================
  // EASY QUESTIONS
  // ========================================

  // Two Sum
  {
    mode: 'debug',
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers that add up to target.

You may assume each input has exactly one solution.

**Example:**
- nums = [2,7,11,15], target = 9 → [0,1] (because nums[0] + nums[1] = 9)`,
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `// Find two numbers that add up to target
function solution(nums, target) {
  // Write your code here
  
}`,
    solution: `function solution(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
    testcases: [
      { input: 'nums = [2,7,11,15]\ntarget = 9', output: '[0,1]', isHidden: false },
      { input: 'nums = [3,2,4]\ntarget = 6', output: '[1,2]', isHidden: false },
      { input: 'nums = [3,3]\ntarget = 6', output: '[0,1]', isHidden: true }
    ],
    hints: ['Use a hash map to store seen numbers', 'Check complement before storing'],
    tags: ['hashmap', 'arrays'],
    timeLimit: 120000,
    memoryLimit: 128
  },

  // Palindrome Number
  {
    mode: 'debug',
    title: 'Palindrome Number',
    description: `Given an integer \`x\`, return true if x is a palindrome, and false otherwise.

**Example:**
- x = 121 → true
- x = -121 → false (reads 121- from right to left)`,
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function solution(x) {
  // Write your code here
  
}`,
    solution: `function solution(x) {
  if (x < 0) return false;
  const str = x.toString();
  const reversed = str.split('').reverse().join('');
  return str === reversed;
}`,
    testcases: [
      { input: 'x = 121', output: 'true', isHidden: false },
      { input: 'x = -121', output: 'false', isHidden: false },
      { input: 'x = 10', output: 'false', isHidden: true }
    ],
    hints: ['Convert to string and check if it equals its reverse'],
    tags: ['math', 'strings'],
    timeLimit: 60000,
    memoryLimit: 64
  },

  // ========================================
  // MEDIUM QUESTIONS
  // ========================================

  // Merge Intervals
  {
    mode: 'debug',
    title: 'Merge Intervals',
    description: `Given an array of \`intervals\` where intervals[i] = [start, end], merge all overlapping intervals.

**Example:**
- intervals = [[1,3],[2,6],[8,10],[15,18]] → [[1,6],[8,10],[15,18]]`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function solution(intervals) {
  // Write your code here
  
}`,
    solution: `function solution(intervals) {
  if (!intervals || intervals.length === 0) return [];
  
  intervals.sort((a, b) => a[0] - b[0]);
  const result = [intervals[0]];
  
  for (let i = 1; i < intervals.length; i++) {
    const last = result[result.length - 1];
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      result.push(intervals[i]);
    }
  }
  return result;
}`,
    testcases: [
      { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]', isHidden: false },
      { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]', isHidden: false },
      { input: 'intervals = [[1,4],[0,4]]', output: '[[0,4]]', isHidden: true }
    ],
    hints: ['Sort intervals by start time', 'Merge if current start <= last end'],
    tags: ['arrays', 'sorting'],
    timeLimit: 120000,
    memoryLimit: 128
  },

  // Subsets
  {
    mode: 'debug',
    title: 'Subsets',
    description: `Given an integer array \`nums\` of unique elements, return all possible subsets (the power set).

**Example:**
- nums = [1,2,3] → [[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function solution(nums) {
  // Write your code here
  
}`,
    solution: `function solution(nums) {
  const result = [];
  
  function backtrack(start, path) {
    result.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }
  
  backtrack(0, []);
  return result;
}`,
    testcases: [
      { input: 'nums = [1,2,3]', output: '[[],[1],[1,2],[1,2,3],[1,3],[2],[2,3],[3]]', isHidden: false },
      { input: 'nums = [0]', output: '[[],[0]]', isHidden: false },
      { input: 'nums = [1,2]', output: '[[],[1],[1,2],[2]]', isHidden: true }
    ],
    hints: ['Use backtracking', 'Each element can either be included or not'],
    tags: ['backtracking', 'recursion'],
    timeLimit: 180000,
    memoryLimit: 256
  },

  // Group Anagrams
  {
    mode: 'debug',
    title: 'Group Anagrams',
    description: `Given an array of strings \`strs\`, group the anagrams together.

**Example:**
- strs = ["eat","tea","tan","ate","nat","bat"] → [["bat"],["nat","tan"],["ate","eat","tea"]]`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `function solution(strs) {
  // Write your code here
  
}`,
    solution: `function solution(strs) {
  const map = new Map();
  
  for (const str of strs) {
    const sorted = str.split('').sort().join('');
    if (!map.has(sorted)) {
      map.set(sorted, []);
    }
    map.get(sorted).push(str);
  }
  
  return Array.from(map.values());
}`,
    testcases: [
      { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: '[["eat","tea","ate"],["tan","nat"],["bat"]]', isHidden: false },
      { input: 'strs = [""]', output: '[[""]]', isHidden: false },
      { input: 'strs = ["a"]', output: '[["a"]]', isHidden: true }
    ],
    hints: ['Sort each string to create a key', 'Group strings with the same sorted key'],
    tags: ['hashmap', 'strings', 'sorting'],
    timeLimit: 120000,
    memoryLimit: 128
  },

  // ========================================
  // HARD QUESTIONS
  // ========================================

  // LRU Cache
  {
    mode: 'debug',
    title: 'LRU Cache',
    description: `Implement an LRU (Least Recently Used) cache with \`get\` and \`put\` operations in O(1) time.

**Input:** capacity, then array of operations
**Operations:** ["LRUCache","put","put","get","put","get"] with args [[2],[1,1],[2,2],[1],[3,3],[2]]

**Example:**
- capacity = 2, operations = put(1,1), put(2,2), get(1), put(3,3), get(2)
- Output: [null,null,null,1,null,-1]`,
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `class LRUCache {
  constructor(capacity) {
    // Write your code here
  }
  
  get(key) {
    // Write your code here
  }
  
  put(key, value) {
    // Write your code here
  }
}

function solution(capacity, operations) {
  const cache = new LRUCache(capacity);
  const results = [];
  
  for (const op of operations) {
    if (op.type === 'put') {
      cache.put(op.key, op.value);
      results.push(null);
    } else if (op.type === 'get') {
      results.push(cache.get(op.key));
    }
  }
  
  return results;
}`,
    solution: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

function solution(capacity, operations) {
  const cache = new LRUCache(capacity);
  const results = [];
  
  for (const op of operations) {
    if (op.type === 'put') {
      cache.put(op.key, op.value);
      results.push(null);
    } else if (op.type === 'get') {
      results.push(cache.get(op.key));
    }
  }
  
  return results;
}`,
    testcases: [
      { input: 'capacity = 2\noperations = [{"type":"put","key":1,"value":1},{"type":"put","key":2,"value":2},{"type":"get","key":1},{"type":"put","key":3,"value":3},{"type":"get","key":2}]', output: '[null,null,1,null,-1]', isHidden: false },
      { input: 'capacity = 2\noperations = [{"type":"put","key":1,"value":1},{"type":"put","key":2,"value":2},{"type":"get","key":1},{"type":"put","key":3,"value":3},{"type":"get","key":2},{"type":"put","key":4,"value":4},{"type":"get","key":1},{"type":"get","key":3},{"type":"get","key":4}]', output: '[null,null,1,null,-1,null,-1,3,4]', isHidden: true }
    ],
    hints: ['Use a Map which maintains insertion order', 'Delete and re-insert on get to move to end'],
    tags: ['hashmap', 'design', 'linked-list'],
    timeLimit: 180000,
    memoryLimit: 256
  },

  // Max Sliding Window
  {
    mode: 'debug',
    title: 'Sliding Window Maximum',
    description: `Given an array \`nums\` and a sliding window size \`k\`, return the max of each window.

**Example:**
- nums = [1,3,-1,-3,5,3,6,7], k = 3 → [3,3,5,5,6,7]`,
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `function solution(nums, k) {
  // Write your code here
  
}`,
    solution: `function solution(nums, k) {
  const result = [];
  const deque = []; // stores indices
  
  for (let i = 0; i < nums.length; i++) {
    // Remove indices outside the window
    while (deque.length && deque[0] <= i - k) {
      deque.shift();
    }
    
    // Remove smaller elements from back
    while (deque.length && nums[deque[deque.length - 1]] < nums[i]) {
      deque.pop();
    }
    
    deque.push(i);
    
    // Add max to result once we have first full window
    if (i >= k - 1) {
      result.push(nums[deque[0]]);
    }
  }
  
  return result;
}`,
    testcases: [
      { input: 'nums = [1,3,-1,-3,5,3,6,7]\nk = 3', output: '[3,3,5,5,6,7]', isHidden: false },
      { input: 'nums = [1]\nk = 1', output: '[1]', isHidden: false },
      { input: 'nums = [1,-1]\nk = 1', output: '[1,-1]', isHidden: true }
    ],
    hints: ['Use a deque to maintain indices of potential max values', 'Remove elements smaller than current from back'],
    tags: ['sliding-window', 'deque', 'monotonic-queue'],
    timeLimit: 180000,
    memoryLimit: 256
  },

  // ========================================
  // BONUS: Common Interview Questions
  // ========================================

  // Valid Parentheses
  {
    mode: 'debug',
    title: 'Valid Parentheses',
    description: `Given a string \`s\` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

**Example:**
- s = "()" → true
- s = "()[]{}" → true
- s = "(]" → false`,
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function solution(s) {
  // Write your code here
  
}`,
    solution: `function solution(s) {
  const stack = [];
  const map = { ')': '(', ']': '[', '}': '{' };
  
  for (const char of s) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else {
      if (stack.pop() !== map[char]) {
        return false;
      }
    }
  }
  
  return stack.length === 0;
}`,
    testcases: [
      { input: 's = "()"', output: 'true', isHidden: false },
      { input: 's = "()[]{}"', output: 'true', isHidden: false },
      { input: 's = "(]"', output: 'false', isHidden: false },
      { input: 's = "([)]"', output: 'false', isHidden: true }
    ],
    hints: ['Use a stack', 'Push opening brackets, pop and check for closing'],
    tags: ['stack', 'strings'],
    timeLimit: 60000,
    memoryLimit: 64
  },

  // Best Time to Buy and Sell Stock
  {
    mode: 'debug',
    title: 'Best Time to Buy and Sell Stock',
    description: `Given an array \`prices\` where prices[i] is the price on day i, find the maximum profit from a single buy/sell.

**Example:**
- prices = [7,1,5,3,6,4] → 5 (buy at 1, sell at 6)`,
    language: 'javascript',
    difficulty: 'easy',
    starterCode: `function solution(prices) {
  // Write your code here
  
}`,
    solution: `function solution(prices) {
  let minPrice = Infinity;
  let maxProfit = 0;
  
  for (const price of prices) {
    minPrice = Math.min(minPrice, price);
    maxProfit = Math.max(maxProfit, price - minPrice);
  }
  
  return maxProfit;
}`,
    testcases: [
      { input: 'prices = [7,1,5,3,6,4]', output: '5', isHidden: false },
      { input: 'prices = [7,6,4,3,1]', output: '0', isHidden: false },
      { input: 'prices = [1,2]', output: '1', isHidden: true }
    ],
    hints: ['Track minimum price so far', 'Calculate profit at each day'],
    tags: ['arrays', 'dynamic-programming'],
    timeLimit: 60000,
    memoryLimit: 64
  }
];

async function seedQuestions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    console.log('Clearing existing debug questions...');
    await Question.deleteMany({ mode: 'debug' });

    console.log('Inserting questions...');
    const inserted = await Question.insertMany(leetcodeQuestions);

    console.log(`\n✅ Successfully seeded ${inserted.length} questions!`);
    console.log('\nInserted questions:');
    inserted.forEach(q => {
      console.log(`  - [${q.difficulty.toUpperCase().padEnd(6)}] ${q.title}`);
      console.log(`    Testcases: ${q.testcases.length}, Tags: ${q.tags.join(', ')}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedQuestions();
}

module.exports = { leetcodeQuestions, seedQuestions };
