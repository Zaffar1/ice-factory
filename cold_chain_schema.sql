-- =========================================================================
-- Cold Chain Ice Factory ERP - Full Database Schema Setup
-- Database: MySQL (5.7+ / 8.0+)
-- =========================================================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS `cold_chain_erp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cold_chain_erp`;

-- Disable foreign key checks temporarily during table creation/reset
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Drop existing tables if they exist (to allow fresh run)
DROP TABLE IF EXISTS `Counters`;
DROP TABLE IF EXISTS `Users`;
DROP TABLE IF EXISTS `Customers`;
DROP TABLE IF EXISTS `Expenses`;
DROP TABLE IF EXISTS `Inventories`;
DROP TABLE IF EXISTS `Orders`;
DROP TABLE IF EXISTS `Payments`;
DROP TABLE IF EXISTS `Productions`;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- 3. Create Tables
-- =========================================================================

-- Table: Counters (Atomically tracks sequence prefixes for Custom IDs)
CREATE TABLE `Counters` (
  `idName` VARCHAR(255) NOT NULL,
  `seq` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`idName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Users (Staff and Administrative accounts)
CREATE TABLE `Users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('Admin', 'Manager', 'Staff') NOT NULL DEFAULT 'Staff',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Customers (Wholesale and Retail buyers)
CREATE TABLE `Customers` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customerId` VARCHAR(255) UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) NOT NULL,
  `type` ENUM('Retail', 'Wholesale') NOT NULL,
  `address` TEXT DEFAULT NULL,
  `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `balanceType` ENUM('Credit', 'Advance') NOT NULL DEFAULT 'Credit',
  `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Expenses (Operational expenditures)
CREATE TABLE `Expenses` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `expenseId` VARCHAR(255) UNIQUE,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `category` ENUM('Electricity', 'Labor', 'Fuel', 'Maintenance', 'Rent', 'Transport', 'Raw Material', 'Other') NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Inventories (Materials and Finished Ice stocks)
CREATE TABLE `Inventories` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `inventoryId` VARCHAR(255) UNIQUE,
  `item` VARCHAR(255) NOT NULL,
  `category` ENUM('Raw Material', 'Finished Goods', 'Packaging', 'Spare Parts') NOT NULL,
  `qty` INTEGER NOT NULL DEFAULT 0,
  `unit` ENUM('Kg', 'Blocks', 'Bags', 'Liters', 'Pcs') NOT NULL,
  `minQty` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Orders (Sales transaction details)
CREATE TABLE `Orders` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` VARCHAR(255) UNIQUE,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `customerId` INTEGER NOT NULL,
  `type` ENUM('Block Ice', 'Tube Ice', 'Crushed Ice') NOT NULL,
  `qty` INTEGER NOT NULL,
  `rate` DECIMAL(10, 2) NOT NULL,
  `amount` DECIMAL(10, 2) DEFAULT NULL,
  `payment` ENUM('Paid', 'Pending', 'Credit', 'Refunded') NOT NULL,
  `status` ENUM('Pending', 'Processing', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_orders_customer`
    FOREIGN KEY (`customerId`) REFERENCES `Customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Payments (Credit recovery and transactions)
CREATE TABLE `Payments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `paymentId` VARCHAR(255) UNIQUE,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `customerId` INTEGER NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `method` ENUM('Cash', 'Bank Transfer', 'Easypaisa', 'JazzCash', 'Cheque') NOT NULL,
  `type` VARCHAR(255) NOT NULL DEFAULT 'Received',
  `note` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_payments_customer`
    FOREIGN KEY (`customerId`) REFERENCES `Customers` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: Productions (Daily factory log shifts)
CREATE TABLE `Productions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productionId` VARCHAR(255) UNIQUE,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `shift` ENUM('Morning', 'Evening', 'Night') NOT NULL,
  `type` ENUM('Block Ice', 'Tube Ice', 'Crushed Ice') NOT NULL,
  `produced` INTEGER NOT NULL,
  `damaged` INTEGER NOT NULL DEFAULT 0,
  `operator` VARCHAR(255) NOT NULL,
  `status` ENUM('In Progress', 'Completed') NOT NULL DEFAULT 'In Progress',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 4. Seed Data (Default Admin User)
--    Password: 'admin123' (bcrypt hashed)
-- =========================================================================
INSERT INTO `Users` (`id`, `name`, `email`, `password`, `role`, `createdAt`, `updatedAt`)
VALUES (
  1, 
  'Admin User', 
  'admin@coldchain.com', 
  '$2a$10$wK1WwzT5tQn7H5Y2mC3WReXbF1v.oUqS.QpC115Gk7N/c8L.q7n5y', 
  'Admin', 
  NOW(), 
  NOW()
)
ON DUPLICATE KEY UPDATE `email` = `email`;

-- =========================================================================
-- 5. Seed Sequential Counters
-- =========================================================================
INSERT INTO `Counters` (`idName`, `seq`) VALUES
('Customer', 0),
('Expense', 0),
('Inventory', 0),
('Order', 0),
('Payment', 0),
('Production', 0)
ON DUPLICATE KEY UPDATE `idName` = `idName`;
