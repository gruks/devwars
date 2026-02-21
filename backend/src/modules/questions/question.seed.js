/**
 * Question Seed Script - LeetCode Style Questions
 * Run: node src/modules/questions/question.seed.js
 */

const mongoose = require('mongoose');
const { Question } = require('./question.model.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/devwars';

/**
 * LeetCode-style Questions (stdin/stdout format)
 * Input: command-separated values on stdin
 * Output: result on stdout
 */
const leetcodeQuestions = [
  // Two Sum - HashMap
  {
    mode: 'debug',
    title: 'Two Sum HashMap Bug',
    description: `Given nums and target, return indices of two numbers that add to target. Current hashmap logic fails on duplicates.

**Input Format:**
nums array (comma-separated), target (on separate line)

**Example Input:**
2,7,11,15
9

**Output Format:**
comma-separated indices (e.g., "0,1")`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `// BUG: Wrong lookup order - stores BEFORE checking
function twoSum(nums, target) {
  const map = new Map();
  for(let i = 0; i < nums.length; i++) {
    let complement = target - nums[i];
    // BUG: Wrong key lookup - checks complement but stores nums[i]
    if(map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

// Read input: first line = nums array, second line = target
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const nums = lines[0].split(',').map(Number);
  const target = parseInt(lines[1]);
  const result = twoSum(nums, target);
  console.log(result.join(','));
});`,
    solution: `// FIXED: Check before storing
function twoSum(nums, target) {
  const map = new Map();
  for(let i = 0; i < nums.length; i++) {
    let complement = target - nums[i];
    if(map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const nums = lines[0].split(',').map(Number);
  const target = parseInt(lines[1]);
  const result = twoSum(nums, target);
  console.log(result.join(','));
});`,
    testcases: [
      { input: '2,7,11,15\n9', output: '0,1', isHidden: false, description: 'Basic case [2,7,11,15], target=9' },
      { input: '3,3\n6', output: '0,1', isHidden: true, description: 'Duplicate values [3,3], target=6' },
      { input: '1,5,3,7\n8', output: '1,2', isHidden: true, description: 'Non-consecutive indices' }
    ],
    hints: ['When do you store vs lookup?', 'Think about order of operations'],
    tags: ['hashmap', 'arrays', 'two-pointers', 'leetcode'],
    timeLimit: 120000,
    memoryLimit: 128
  },

  // Merge Intervals
  {
    mode: 'debug',
    title: 'Merge Intervals Overlap Bug',
    description: `Merge overlapping intervals.

**Input Format:**
Intervals as semicolon-separated pairs (each pair is comma-separated)

**Example Input:**
1,3;2,6;8,10;15,18

**Output Format:**
Merged intervals as semicolon-separated pairs`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `// BUG: Wrong merge condition and wrong result array
function merge(intervals) {
  intervals.sort((a,b) => a[0] - b[0]);
  const result = [];
  for(let i = 1; i < intervals.length; i++) {
    // BUG: Wrong merge condition - compares to intervals[i-1] but should use result
    if(intervals[i][0] <= intervals[i-1][1]) {
      intervals[i-1][1] = Math.max(intervals[i-1][1], intervals[i][1]);
    } else {
      result.push(intervals[i-1]);
    }
  }
  return result;
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const intervals = lines[0].split(';').map(p => p.split(',').map(Number));
  const result = merge(intervals);
  console.log(result.map(r => r.join(',')).join(';'));
});`,
    solution: `// FIXED: Use result array correctly
function merge(intervals) {
  if (!intervals || intervals.length === 0) return [];
  intervals.sort((a,b) => a[0] - b[0]);
  const result = [intervals[0]];
  for(let i = 1; i < intervals.length; i++) {
    let last = result[result.length - 1];
    if(intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1]);
    } else {
      result.push(intervals[i]);
    }
  }
  return result;
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const intervals = lines[0].split(';').map(p => p.split(',').map(Number));
  const result = merge(intervals);
  console.log(result.map(r => r.join(',')).join(';'));
});`,
    testcases: [
      { input: '1,3;2,6;8,10;15,18', output: '1,6;8,10;15,18', isHidden: false, description: 'Overlapping intervals' },
      { input: '1,4;4,5', output: '1,5', isHidden: false, description: 'Adjacent intervals' },
      { input: '1,4;0,4', output: '0,4', isHidden: true, description: 'Fully contained' },
      { input: '1,4;2,3', output: '1,4', isHidden: true, description: 'One inside another' }
    ],
    hints: ['Initialize result with first interval', 'Use result array, not input'],
    tags: ['arrays', 'sorting', 'intervals', 'leetcode'],
    timeLimit: 120000,
    memoryLimit: 128
  },

  // Subsets - Backtracking
  {
    mode: 'debug',
    title: 'Subsets Backtracking Bug',
    description: `Generate all subsets (power set) of a set of distinct integers.

**Input Format:**
Comma-separated numbers

**Example Input:**
1,2,3

**Output Format:**
Subsets as semicolon-separated arrays (each array uses comma)`,
    language: 'javascript',
    difficulty: 'medium',
    starterCode: `// BUG: Wrong loop bounds - uses <= instead of <
function subsets(nums) {
  const result = [];
  function backtrack(start, path) {
    result.push([...path]);
    // BUG: Wrong loop bounds - i <= nums.length causes out of bounds
    for(let i = start; i <= nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }
  backtrack(0, []);
  return result;
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', (line) => {
  const nums = line.split(',').map(Number);
  const result = subsets(nums);
  // Sort: empty first, then by length
  result.sort((a,b) => a.length - b.length);
  console.log(result.map(r => r.join(',')).join(';'));
});`,
    solution: `// FIXED: Correct loop bounds
function subsets(nums) {
  const result = [];
  function backtrack(start, path) {
    result.push([...path]);
    // FIXED: i < nums.length
    for(let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }
  backtrack(0, []);
  return result;
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', (line) => {
  const nums = line.split(',').map(Number);
  const result = subsets(nums);
  result.sort((a,b) => a.length - b.length);
  console.log(result.map(r => r.join(',')).join(';'));
});`,
    testcases: [
      { input: '1,2,3', output: ';1;2;1,2;3;1,3;2,3;1,2,3', isHidden: false, description: 'All 8 subsets of [1,2,3]' },
      { input: '1', output: ';1', isHidden: true, description: 'Single element' },
      { input: '1,2', output: ';1;2;1,2', isHidden: true, description: 'Two elements' }
    ],
    hints: ['Loop should be i < length, not <= length', 'Avoid index out of bounds'],
    tags: ['backtracking', 'recursion', 'bitmask', 'leetcode'],
    timeLimit: 180000,
    memoryLimit: 256
  },

  // LRU Cache
  {
    mode: 'debug',
    title: 'LRU Cache Eviction Bug',
    description: `Implement LRU Cache with get/put O(1).

**Input Format:**
capacity (on first line), operations (comma-separated on second line)
Operations: get(X) or put(X,Y)

**Example Input:**
2
put(1,1),put(2,2),get(1),put(3,3),get(2)

**Output Format:**
Comma-separated results (-1 for miss, value for hit)`,
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `// BUG: Missing moveToFront on get
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  get(key) {
    if(this.cache.has(key)) {
      // BUG: Missing moveToFront - should delete and reinsert to mark as recently used
      return this.cache.get(key);
    }
    return -1;
  }
  put(key, value) {
    if(this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if(this.cache.size > this.capacity) {
      // Delete first (oldest) item
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const capacity = parseInt(lines[0]);
  const ops = lines[1].split(',').map(op => op.trim());
  const cache = new LRUCache(capacity);
  const results = [];
  
  for(let op of ops) {
    if(op.startsWith('get(')) {
      const key = parseInt(op.match(/get\\((\\d+)\\)/)[1]);
      results.push(cache.get(key));
    } else if(op.startsWith('put(')) {
      const match = op.match(/put\\((\\d+),(\\d+)\\)/);
      cache.put(parseInt(match[1]), parseInt(match[2]));
    }
  }
  console.log(results.join(','));
});`,
    solution: `// FIXED: Proper moveToFront on get
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  get(key) {
    if(this.cache.has(key)) {
      const val = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, val);
      return val;
    }
    return -1;
  }
  put(key, value) {
    if(this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if(this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const capacity = parseInt(lines[0]);
  const ops = lines[1].split(',').map(op => op.trim());
  const cache = new LRUCache(capacity);
  const results = [];
  
  for(let op of ops) {
    if(op.startsWith('get(')) {
      const key = parseInt(op.match(/get\\((\\d+)\\)/)[1]);
      results.push(cache.get(key));
    } else if(op.startsWith('put(')) {
      const match = op.match(/put\\((\\d+),(\\d+)\\)/);
      cache.put(parseInt(match[1]), parseInt(match[2]));
    }
  }
  console.log(results.join(','));
});`,
    testcases: [
      { input: '2\nput(1,1),put(2,2),get(1),put(3,3),get(2)', output: '1,-1', isHidden: false, description: 'LRU eviction test' },
      { input: '2\nput(1,1),put(2,2),put(3,3),put(4,4),get(4),get(3),get(2),get(1)', output: '4,-1,-1,-1', isHidden: true, description: 'Multiple evictions' }
    ],
    hints: ['Hits must move to front', 'Delete then reinsert for MRU'],
    tags: ['hashmap', 'doubly-linked-list', 'design', 'leetcode'],
    timeLimit: 180000,
    memoryLimit: 256
  },

  // K Closest Points
  {
    mode: 'debug',
    title: 'K Closest Points Priority Queue',
    description: `Return k closest points to origin using max-heap logic.

**Input Format:**
points (semicolon-separated pairs, comma-separated coords), k (on separate line)

**Example Input:**
1,3;-2,2
1

**Output Format:**
K closest points as semicolon-separated pairs`,
    language: 'javascript',
    difficulty: 'hard',
    starterCode: `// BUG: No sorting to maintain max-heap property
function kClosest(points, k) {
  const heap = [];
  for(let point of points) {
    const dist = point[0]**2 + point[1]**2;
    // BUG: Just pushes without maintaining heap property
    heap.push({point, dist});
    if(heap.length > k) {
      heap.pop(); // Just removes last, not the farthest!
    }
  }
  return heap.map(h => h.point);
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const points = lines[0].split(';').map(p => p.split(',').map(Number));
  const k = parseInt(lines[1]);
  const result = kClosest(points, k);
  console.log(result.map(p => p.join(',')).join(';'));
});`,
    solution: `// FIXED: Sort to maintain max-heap
function kClosest(points, k) {
  const heap = [];
  for(let point of points) {
    const dist = point[0]**2 + point[1]**2;
    heap.push({point, dist});
    if(heap.length > k) {
      // Sort descending by distance (max-heap), then pop farthest
      heap.sort((a,b) => b.dist - a.dist);
      heap.pop();
    }
  }
  return heap.map(h => h.point);
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const points = lines[0].split(';').map(p => p.split(',').map(Number));
  const k = parseInt(lines[1]);
  const result = kClosest(points, k);
  console.log(result.map(p => p.join(',')).join(';'));
});`,
    testcases: [
      { input: '1,3;-2,2\n1', output: '-2,2', isHidden: false, description: 'Closest to origin' },
      { input: '3,3;5,-1;-2,4\n2', output: '3,3;-2,4', isHidden: true, description: 'K=2 case' }
    ],
    hints: ['Max-heap: keep largest distances at end', 'Maintain heap size <= k'],
    tags: ['heap', 'priority-queue', 'sorting', 'leetcode'],
    timeLimit: 180000,
    memoryLimit: 256
  }
];

async function seedQuestions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    console.log('Clearing existing debug questions...');
    await Question.deleteMany({ mode: 'debug' });

    console.log('Inserting LeetCode-style questions...');
    const inserted = await Question.insertMany(leetcodeQuestions);

    console.log(`\n✅ Successfully seeded ${inserted.length} questions!`);
    console.log('\nInserted questions:');
    inserted.forEach(q => {
      console.log(`  - [${q.difficulty.toUpperCase()}] ${q.title} (${q.language})`);
      console.log(`    Testcases: ${q.testcases.length}`);
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
