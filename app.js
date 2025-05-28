import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  orderBy,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Select elements
const authSection = document.getElementById('auth-section');
const dashboard = document.getElementById('dashboard');
const authBtn = document.getElementById('auth-btn');
const authTitle = document.getElementById('auth-title');
const toggleAuth = document.getElementById('toggle-auth');

let isLogin = true;

// Toggle between login and signup
function attachSwitchModeListener() {
  const switchMode = document.getElementById('switch-mode');
  switchMode.addEventListener('click', () => {
    isLogin = !isLogin;

    // Update the title and button text
    authTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    authBtn.innerHTML = isLogin
      ? '<i class="fas fa-sign-in-alt"></i> Login'
      : '<i class="fas fa-user-plus"></i> Sign Up';

    // Update the toggle text
    toggleAuth.innerHTML = isLogin
      ? "Don't have an account? <span id='switch-mode'>Sign up</span>"
      : "Already have an account? <span id='switch-mode'>Login</span>";

    // Show or hide the username field based on the mode
    document.getElementById('username').style.display = isLogin ? 'none' : 'block';

    // Reattach the event listener for the dynamically updated switchMode button
    attachSwitchModeListener();
  });
}

// Attach the initial event listener
attachSwitchModeListener();





// Authentication
authBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const usernameInput = document.getElementById('username');
  const username = usernameInput ? usernameInput.value : null;

  // Validate inputs
  if (!email || !password || (!isLogin && !username)) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    if (isLogin) {
      // Login logic
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // Signup logic
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        username: username,
        monthlyIncome: 0 // Default income is 0
      });

      alert("Signup successful! You are now logged in.");
    }
  } catch (error) {
    alert(error.message);
  }
});

// Logout Function
window.logout = function () {
  signOut(auth).then(() => {
    console.log("User logged out successfully");
    alert("User logged out successfully");
    // alert("successfully logout");
  }).catch((error) => {
    console.error("Error logging out:", error);
  });
};

// Handle Auth State Changes
onAuthStateChanged(auth, async (user) => {
  const landingSection = document.getElementById('landing-section');
  const authSection = document.getElementById('auth-section');
  const dashboard = document.getElementById('dashboard');

  if (user) {
    // User is logged in
    landingSection.style.display = 'none';
    authSection.style.display = 'none';
    dashboard.style.display = 'block';

    // Fetch and display username and monthly income
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      document.getElementById('dashboard-username').textContent = userData.username ? `Welcome, ${userData.username}` : '';
      document.getElementById('total-income').textContent = formatCurrency(userData.monthlyIncome || 0);

      // Prompt to set income if not set (first login)
      if (!userData.monthlyIncome || userData.monthlyIncome === 0) {
        setTimeout(async () => {
          let income = null;
          while (income === null) {
            const input = prompt("Set your monthly income to start tracking:");
            if (input === null) break; // User cancelled
            const value = parseFloat(input);
            if (!isNaN(value) && value > 0) {
              await updateDoc(doc(db, 'users', user.uid), { monthlyIncome: value });
              alert("Monthly income set!");
              updateSummaryData();
              break;
            } else {
              alert("Please enter a valid positive number.");
            }
          }
        }, 500);
      }
    }

    loadExpenses();  // Load expenses on user login
    updateDashboardDate(); // Set the current month and year
    updateSummaryData(); // Update the summary cards and chart
  } else {
    // User is not logged in
    landingSection.style.display = 'block'; // Show the landing page
    authSection.style.display = 'none';    // Hide the login page
    dashboard.style.display = 'none';     // Hide the dashboard
  }
});



// Update Dashboard Date
function updateDashboardDate() {
  const now = new Date();
  const month = now.toLocaleString('default', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  document.querySelector('.logout-container h2').textContent = `${month} ${year}`;
}

// Add Expense Function
window.addExpense = async function () {
  const descInput = document.getElementById('desc');
  const amountInput = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const desc = descInput.value;
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;
  const user = auth.currentUser;

  if (!user) return;

  if (!desc || isNaN(amount) || !category) {
    alert("Please fill in all fields.");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, 'expenses'), {
      uid: user.uid,
      desc,
      amount,
      category,
      date: Timestamp.now()
    });

    console.log("Expense added with ID: ", docRef.id);

    // Clear the input fields after successful addition
    descInput.value = '';
    amountInput.value = '';
    categoryInput.value = '';

    loadExpenses(); // Refresh the expense list after adding
    updateSummaryData(); // Update the summary data
  } catch (error) {
    console.error("Error adding expense: ", error.message, error.code);
    alert("Failed to add expense. Please try again.");
  }
};

// Format currency function
function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

// Format date function
function formatDate(timestamp) {
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}



// Load Expenses Function
async function loadExpenses(month = null) {
  const expenseList = document.getElementById('expense-list');
  expenseList.innerHTML = '';  // Clear the list before loading new data
  const totalAmountElem = document.getElementById('total-amount');

  const user = auth.currentUser;
  if (!user) return;

  try {
    let q = query(
      collection(db, 'expenses'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc') // Latest first
    );

    const snapshot = await getDocs(q);
    let total = 0;

    if (snapshot.empty) {
      expenseList.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">No expenses found. Add your first expense!</p>`;
      totalAmountElem.textContent = `Total: ${formatCurrency(0)}`;
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateObj = data.date.toDate();
      const monthYear = dateObj.toISOString().slice(0, 7);

      if (!month || monthYear === month) {
        // Create expense item
        const li = document.createElement('li');
        li.className = 'expense-item';

        // Create details section
        const details = document.createElement('div');
        details.className = 'details';

        const desc = document.createElement('span');
        desc.className = 'desc';
        desc.textContent = data.desc;

        const date = document.createElement('span');
        date.className = 'date';
        date.textContent = formatDate(data.date);

        details.appendChild(desc);
        details.appendChild(date);

        // Create right content
        const rightContent = document.createElement('div');
        rightContent.className = 'right-content';

        const category = document.createElement('span');
        category.className = `category ${data.category}`;
        category.textContent = data.category;

        const amount = document.createElement('span');
        amount.className = 'amount';
        amount.textContent = formatCurrency(data.amount);

        rightContent.appendChild(category);
        rightContent.appendChild(amount);

        // Create action buttons
        const actions = document.createElement('div');
        actions.className = 'expense-actions';

        const editButton = document.createElement('button');
        editButton.className = 'edit-btn';
        editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editButton.onclick = () => handleEdit(doc.id, data);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.innerHTML = '<i class="fas fa-trash"></i> Delete';
        deleteButton.onclick = () => handleDelete(doc.id);

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        rightContent.appendChild(actions);

        // Append all sections to the list item
        li.appendChild(details);
        li.appendChild(rightContent);

        expenseList.appendChild(li);
        total += data.amount;
      }
    });

    totalAmountElem.textContent = `Total: ${formatCurrency(total)}`;
  } catch (error) {
    console.error("Error loading expenses:", error);
    expenseList.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Error loading expenses. Please try again.</p>`;
  }
}

// Filter Expenses by Month
window.filterByMonth = function () {
  const selectedMonth = document.getElementById('monthPicker').value;
  loadExpenses(selectedMonth);
};

// Handle Expense Deletion
async function handleDelete(id) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  const expenseRef = doc(db, 'expenses', id);
  try {
    await deleteDoc(expenseRef);
    console.log("Expense deleted successfully");
    alert("Deleted successfully")
    loadExpenses(); // Refresh the expense list after deletion
    updateSummaryData(); // Update the summary data
  } catch (error) {
    console.error("Error deleting expense: ", error);
    alert("Failed to delete expense. Please try again.");
  }
}

// Handle Expense Editing - Modal approach could be better but this is simpler
async function handleEdit(id, data) {
  const newDesc = prompt("Edit description", data.desc);
  if (newDesc === null) return; // User cancelled

  const newAmount = prompt("Edit amount", data.amount);
  if (newAmount === null) return; // User cancelled

  const newCategory = prompt("Edit category (Food, Travel, Health, Shopping, Bills, Entertainment, Other)", data.category);
  if (newCategory === null) return; // User cancelled

  if (newDesc && !isNaN(parseFloat(newAmount)) && newCategory) {
    try {
      const expenseRef = doc(db, 'expenses', id);
      await updateDoc(expenseRef, {
        desc: newDesc,
        amount: parseFloat(newAmount),
        category: newCategory
      });

      console.log("Expense updated successfully");
      // alert("edit successfully")
      loadExpenses(); // Refresh the expense list after update
      updateSummaryData(); // Update the summary data
    } catch (error) {
      console.error("Error updating expense: ", error);
      alert("Failed to update expense. Please try again.");
    }
  } else {
    alert("Invalid input. Please ensure amount is a number.");
  }
}



// Calculate and update summary data
async function updateSummaryData() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Get monthly income from user document
    let totalIncome = 0;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      totalIncome = userData.monthlyIncome || 0;
    }

    // Get expenses
    const q = query(collection(db, 'expenses'), where('uid', '==', user.uid));
    const snapshot = await getDocs(q);

    let totalExpense = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalExpense += data.amount;
    });

    const balance = totalIncome - totalExpense;

    // Update summary cards
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);

    // Update safe to spend in the circular chart
    document.getElementById('safe-amount').textContent = formatCurrency(balance);

    // Update circular chart percentage
    const expensePercent = totalIncome > 0 ? Math.min(100, Math.round((totalExpense / totalIncome) * 100)) : 0;
    const safePercent = 100 - expensePercent;

    const circleElement = document.querySelector('.circle.safe-circle');
    circleElement.setAttribute('stroke-dasharray', `${safePercent}, 100`);

  } catch (error) {
    console.error("Error updating summary data:", error);
  }
}

// Initialize month picker with current month
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() returns 0-11
  const year = now.getFullYear();

  const monthStr = month < 10 ? `0${month}` : month;
  document.getElementById('monthPicker').value = `${year}-${monthStr}`;
});

// Handle "Get Started" button click
document.getElementById('get-started-btn').addEventListener('click', () => {
  // Hide the landing page
  document.getElementById('landing-section').style.display = 'none';
  // Show the login page
  document.getElementById('auth-section').style.display = 'block';
});

document.getElementById('get-started-btn').addEventListener('click', () => {
  // Hide the landing page
  document.getElementById('landing-section').style.display = 'none';
  // Show the login page
  document.getElementById('auth-section').style.display = 'block';
});


// const expenseData = {
//   labels: [
//     "Utilities", "Insurances", "Mobile communication", "Internet provider",
//     "Gym membership", "Media subscription", "Food", "Loan payment",
//     "Savings", "Travel", "Leisure", "Clothes", "Other Expenses"
//   ],
//   datasets: [{
//     data: [972, 8000, 279, 0, 50, 2000, 176.70, 1740, 3500, 1049, 149, 62, 2600],
//     backgroundColor: [
//       "#42a5f5", "#ef5350", "#66bb6a", "#ab47bc", "#ffa726", "#29b6f6", "#ffee58",
//       "#8d6e63", "#26c6da", "#ff7043", "#7e57c2", "#9ccc65", "#d4e157"
//     ]
//   }]
// };

// const input = document.getElementById("income-input");
// const incomeDisplay = document.getElementById("total-income");
// const addButton = document.getElementById("add-income-btn");

// addButton.addEventListener("click", () => {
//   const inputAmount = parseInt(input.value, 10);

//   if (!isNaN(inputAmount) && inputAmount > 0) {
//     // Get current income, remove ₹ and commas, then parse as number
//     let currentAmount = incomeDisplay.textContent.replace(/[₹,]/g, '');
//     currentAmount = parseInt(currentAmount, 10) || 0;

//     // Add the new input amount to the current amount
//     const newTotal = currentAmount + inputAmount;

//     // Update the income display with proper formatting
//     incomeDisplay.textContent = `₹${newTotal.toLocaleString('en-IN')}`;

//     // Clear the input field after adding
//     input.value = "";
//   } else {
//     alert("Please enter a valid positive number.");
//   }
// });
// input.addEventListener("blur", () => {
//   const inputAmount = parseInt(input.value, 10);

//   if (!isNaN(inputAmount) && inputAmount > 0) {
//     let currentAmount = incomeDisplay.textContent.replace(/[₹,]/g, '');
//     currentAmount = parseInt(currentAmount, 10) || 0;

//     const newTotal = currentAmount + inputAmount;
//     incomeDisplay.textContent = `₹${newTotal.toLocaleString('en-IN')}`;
//     input.value = "";
//   }
// });


// document.addEventListener("DOMContentLoaded", () => {
//   const input = document.getElementById("income-input");
//   const incomeDisplay = document.getElementById("total-income");

//   input.addEventListener("keydown", (event) => {
//     if (event.key === "Enter") {
//       const inputAmount = parseInt(input.value, 10);

//       if (!isNaN(inputAmount) && inputAmount > 0) {
//         // Remove ₹ and commas, and convert to number
//         let currentAmount = incomeDisplay.textContent.replace(/[₹,]/g, '');
//         currentAmount = parseInt(currentAmount, 10); // Will be 0 if it's "₹0"

//         if (isNaN(currentAmount)) currentAmount = 0;

//         const newTotal = currentAmount + inputAmount;

//         incomeDisplay.textContent = `₹${newTotal.toLocaleString('en-IN')}`;
//         input.value = "";
//       } else {
//         alert("Please enter a valid positive number.");
//       }
//     }
//   });
// });


// function addIncome() {
//   const input = document.getElementById("income-input");
//   const incomeDisplay = document.getElementById("total-income");
//   const inputAmount = parseInt(input.value, 10);

//   if (!isNaN(inputAmount) && inputAmount > 0) {
//     // Remove ₹ symbol and commas
//     let currentAmount = incomeDisplay.textContent.replace(/[₹,]/g, '');
//     currentAmount = parseInt(currentAmount, 10);

//     // If it's NaN (e.g. first time or corrupted text), set to 0
//     if (isNaN(currentAmount)) currentAmount = 0;

//     const newTotal = currentAmount + inputAmount;

//     // Format and update
//     incomeDisplay.textContent = `₹${newTotal.toLocaleString('en-IN')}`;
//     input.value = "";
//   } else {
//     alert("Please enter a valid positive number.");
//   }
// }

document.addEventListener('DOMContentLoaded', () => {
  const editIncomeBtn = document.getElementById('edit-income-btn');
  if (editIncomeBtn) {
    editIncomeBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let currentIncome = 0;
      if (userDoc.exists()) {
        currentIncome = userDoc.data().monthlyIncome || 0;
      }

      const newIncomeStr = prompt("Enter your new monthly income:", currentIncome);
      const newIncome = parseFloat(newIncomeStr);

      if (!isNaN(newIncome) && newIncome >= 0) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { monthlyIncome: newIncome });
          alert("Monthly income updated!");
          updateSummaryData();
        } catch (error) {
          alert("Failed to update income. Please try again.");
        }
      } else if (newIncomeStr !== null) {
        alert("Please enter a valid number.");
      }
    });
  }
});



