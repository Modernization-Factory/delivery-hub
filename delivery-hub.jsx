import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { LayoutDashboard, Plane, CalendarDays, ListChecks, BarChart3, Clock, Table, TrendingUp, GitBranch, FolderKanban, Gauge, Hourglass, Users, Settings as SettingsIcon, Shield, Lock, ExternalLink, ClipboardList, Activity } from "lucide-react";

// ============================================================
// SEED DATA — extracted from the three source trackers
// E: [name, role, company, start, term]
// L: [name, start, end, type]  (leave records)
// C: [name, dateWorked, earnedDays, reason]  (comp-off earned)
// T: [name, release, remarks, [[SF,JIRA] x weeks]]
// W: week-ending dates  |  H: holidays
// ============================================================
const SEED = {"E":[["Abhishek Agarwal","Lead Developer","MDB","2026-05-04",null,"R2"],["Abhishek Chauhan","Senior Developer","MDB","2026-03-01",null,"R1"],["Abhishek Kumar","Senior Developer","WeKan","2026-03-01",null,"R1"],["Abhishek Pandey","Developer","Ciklum","2026-03-01",null,"R2"],["Aditya Sangar","Developer","MDB","2026-03-01",null,"R2"],["Ajay Singh Thakur","Developer","MDB","2026-03-01",null,"R2"],["Akshay Bawankule","Developer","Globant","2026-03-01",null,"R2"],["Akshay Jain","Senior Developer","MDB","2026-03-01",null,"R2"],["Akshay Kapoor","Lead Developer","MDB","2026-03-01",null,"R2"],["Aman Bharti","Developer","Ciklum","2026-03-01",null,"R2"],["Amit Jain(L)","Senior Developer","MDB","2026-03-01",null,"R2"],["Amrish Yashpal","Developer","Ciklum","2026-03-01",null,"R2"],["Anand Shirahatti","Developer","WeKan","2026-03-01",null,"R2"],["Aniket Sambhaji","Developer","Ciklum","2026-03-01",null,"R2"],["Ankit Giri","Developer","MDB","2026-03-01",null,"R1"],["Arpit Rai","Developer","Globant","2026-03-01",null,"R2"],["Ashita Sharma","Developer","Globant","2026-03-01",null,"R2"],["Ashu Gupta","Lead Developer","MDB","2026-03-01",null,"R1"],["Ataur Rahman","Developer","Ciklum","2026-03-01",null,"R2"],["Bhargavi V","Developer","WeKan","2026-03-01",null,"R2"],["Brahadish Balakrishnan","Developer","Ciklum","2026-03-01",null,"R2"],["Chaitanya Kuthiala","Senior Developer","MDB","2026-03-01",null,"R2"],["Charu Singh","Senior Developer","MDB","2026-03-01",null,"R2"],["Chittineni Gaurav","Developer","WeKan","2026-03-01",null,"R2"],["Christopher Niklowoski","Developer","MDB","2026-03-01",null,"R2"],["Deepak G","Developer","WeKan","2026-03-01",null,"R2"],["Devashish Sakesna","Senior Developer","MDB","2026-03-01",null,"R2"],["Devesh Bhangle","Developer","Globant","2026-03-01",null,"R2"],["Dheeraj Mamdamanchi","Developer","Globant","2026-03-01",null,"R2"],["Dushyant Sharma","Project Manager","MDB","2026-03-01",null,"R2"],["Ganesh D","Developer","WeKan","2026-03-01",null,"R2"],["Gaurav Jain","Senior Developer","MDB","2026-03-01",null,"R2"],["Heena Mittal","Senior Developer","MDB","2026-03-01",null,"R2"],["Himanshu Mishra","Senior Developer","MDB","2026-03-01",null,"R2"],["Hunny Pal","Senior Developer","Ciklum","2026-03-01",null,"R2"],["Jagpreet Singh","Lead Developer","MDB","2026-03-01",null,"R2"],["Kavin Kumaar PB","Senior Developer","WeKan","2026-03-01",null,"R1"],["Lakshmitha H N","Developer","WeKan","2026-03-01",null,"R2"],["Laszlo Guylas","Developer","MDB","2026-03-01",null,"R2"],["Lazar Dukic","Developer","MDB","2026-03-01",null,"R2"],["Maitreya Arun Tayde","Developer","Ciklum","2026-03-01",null,"R2"],["Manmeet","Senior Developer","MDB","2026-03-01",null,"R1"],["Megha Gaikwad","Developer","Globant","2026-03-01",null,"R2"],["Mehmood Ahmed Banthiya","Developer","Ciklum","2026-03-01",null,"R2"],["Mejari Kumar","Developer","Ciklum","2026-03-01",null,"R2"],["Momi Ahmed","Developer","WeKan","2026-03-01",null,"R2"],["Mounika J","Developer","WeKan","2026-03-01",null,"R2"],["Mridul Mahajan","Developer","MDB","2026-03-01",null,"R1"],["Naga Kartheek Yejandla","Senior Developer","WeKan","2026-03-01",null,"R2"],["Naveen Teja","Developer","WeKan","2026-03-01",null,"R2"],["Nitin Kumar Agarwal","Senior Developer","MDB","2026-03-01",null,"R2"],["Omkar Ganpati Patil","Developer","Ciklum","2026-03-01",null,"R2"],["Pradeep Kumar N","Developer","WeKan","2026-03-01",null,"R2"],["Prerna","Senior Developer","MDB","2026-03-01",null,"R1"],["Puja Jain","Developer","Ciklum","2026-03-01",null,"R2"],["Pushpak","Developer","Ciklum","2026-03-01",null,"R1"],["Rahul Masule","Developer","Globant","2026-03-01",null,"R2"],["Ramkrishna Raghuwanshi","Developer","Globant","2026-03-01",null,"R2"],["Ramsharan Prajapati","Senior Developer","Ciklum","2026-03-01",null,"R2"],["Relli Raghunadha","Developer","Ciklum","2026-03-01",null,"R2"],["Riddhi Agarwal","Senior Developer","MDB","2026-03-01",null,"R1"],["Rishimaan Shukla","Developer","Ciklum","2026-03-01",null,"R2"],["Ritish Ghosh","Senior Developer","MDB","2026-03-01",null,"R2"],["Rohit Choudhary","Developer","MDB","2026-03-01",null,"R2"],["Sachit Misra","Developer","MDB","2026-03-01",null,"R2"],["Samriti Arora","Senior Developer","MDB","2026-03-01",null,"R2"],["Sanchit Kapoor","Senior Developer","MDB","2026-03-01",null,"R1"],["Sandeep Tarte","Developer","Globant","2026-03-01",null,"R2"],["Sanjay Verma","Developer","WeKan","2026-03-01",null,"R2"],["Santhosh Kashyap","Developer","MDB","2026-03-01",null,"R2"],["Sathya Sai","Developer","WeKan","2026-03-01",null,"R2"],["Shashikumar De","Senior Developer","WeKan","2026-03-01",null,"R2"],["Shivam Chauhan","Developer","WeKan","2026-03-01",null,"R2"],["Shivam Gouri","Developer","MDB","2026-03-01",null,"R2"],["Shivpratap Chouhan","Developer","Globant","2026-03-01",null,"R2"],["Shradha Chavan","Developer","Globant","2026-03-01",null,"R2"],["Sijo Saji","Developer","MDB","2026-03-01",null,"R1"],["Soloman Kumar","Developer","WeKan","2026-03-01",null,"R2"],["Sourabh Maji","Developer","Ciklum","2026-03-01",null,"R2"],["Sourav Mallick","Developer","WeKan","2026-03-01",null,"R2"],["Sudha Basavaraja","Developer","Ciklum","2026-03-01",null,"R2"],["Sukanya Ingole","Developer","Globant","2026-03-01",null,"R2"],["Sumit Gurav","Senior Developer","Globant","2026-03-01",null,"R2"],["Suprakash Samantaray","Developer","WeKan","2026-03-01",null,"R2"],["Talasila Yogananda Krishna","Developer","WeKan","2026-03-01",null,"R2"],["Tarun Teja","Senior Developer","WeKan","2026-03-01",null,"R1"],["Udaykumar Patel","Developer","Globant","2026-03-01",null,"R2"],["Umag Soni","Developer","Globant","2026-03-01",null,"R2"],["Utkarsh Jha","Developer","MDB","2026-03-01",null,"R1"],["Vasupalli Jairam Kiran","Developer","WeKan","2026-03-01",null,"R2"],["Vijay Pratap","Senior Developer","Globant","2026-03-01",null,"R2"],["Vikas Pawar","Senior Developer","Globant","2026-03-01",null,"R2"],["Vikrant Dureja","Project Manager","MDB","2026-03-01",null,"R1"],["Yogendra Reddy","Developer","WeKan","2026-03-01",null,"R2"],["Yuvasri Sankar","Developer","Ciklum","2026-03-01",null,"R2"],["Akshay Dhote","Developer","MDB","2026-03-01",null,null],["Darsiguntla Venkatapullaiah","Developer","WeKan","2026-03-01",null,null],["Prathibha S N","Developer","WeKan","2026-03-01",null,null],["Sai Kiran","Developer","WeKan","2026-03-01",null,null],["Bharathi K","Developer","WeKan","2026-04-14",null,"R2"],["Ram Sharan","Developer","Ciklum","2026-04-27",null,"R2"],["Reli","Developer","Ciklum","2026-04-29",null,"R2"]],"L":[["Dushyant Sharma","2026-04-16","2026-04-16","Vacation"],["Vikrant Dureja","2026-04-10","2026-04-10","Vacation"],["Ritish Ghosh","2026-05-08","2026-05-08","Vacation"],["Abhishek Pandey","2026-05-01","2026-05-01","Vacation"],["Sukanya Ingole","2026-04-24","2026-04-24","Vacation"],["Devesh Bhangle","2026-05-01","2026-05-01","Vacation"],["Devesh Bhangle","2026-04-27","2026-04-27","Vacation"],["Devesh Bhangle","2026-05-06","2026-05-06","Half Day"],["Nitin Kumar Agarwal","2026-04-24","2026-04-29","Vacation"],["Puja Jain","2026-04-30","2026-04-30","Vacation"],["Puja Jain","2026-05-01","2026-05-01","Vacation"],["Abhishek Pandey","2026-05-04","2026-05-04","Sick"],["Puja Jain","2026-05-18","2026-05-18","Vacation"],["Shivpratap Chouhan","2026-04-21","2026-04-24","Vacation"],["Vijay Pratap","2026-04-16","2026-04-17","Sick"],["Maitreya Arun Tayde","2026-05-01","2026-05-01","Vacation"],["Maitreya Arun Tayde","2026-05-04","2026-05-04","Sick"],["Darsiguntla Venkatapullaiah","2026-04-28","2026-04-30","Vacation"],["Aniket Sambhaji","2026-04-21","2026-04-21","Vacation"],["Aniket Sambhaji","2026-04-29","2026-04-29","Vacation"],["Rishimaan Shukla","2026-04-20","2026-04-22","Vacation"],["Heena Mittal","2026-04-20","2026-04-20","Sick"],["Anand Shirahatti","2026-04-27","2026-04-27","Sick"],["Santhosh Kashyap","2026-04-28","2026-04-28","Vacation"],["Samriti Arora","2026-05-29","2026-05-29","Vacation"],["Devesh Bhangle","2026-05-27","2026-05-27","Vacation"],["Akshay Bawankule","2026-04-28","2026-04-29","Vacation"],["Sudha Basavaraja","2026-05-04","2026-05-05","Vacation"],["Sandeep Tarte","2026-04-30","2026-04-30","Vacation"],["Shradha Chavan","2026-04-29","2026-04-29","Sick"],["Umag Soni","2026-05-05","2026-05-13","Vacation"],["Sai Kiran","2026-04-30","2026-04-30","Vacation"],["Ritish Ghosh","2026-04-27","2026-04-27","Sick"],["Prathibha S N","2026-04-30","2026-04-30","Sick"],["Ataur Rahman","2026-05-01","2026-05-01","Vacation"],["Ataur Rahman","2026-04-20","2026-04-20","Sick"],["Relli Raghunadha","2026-05-14","2026-05-15","Vacation"],["Dushyant Sharma","2026-06-01","2026-06-05","Vacation"],["Chaitanya Kuthiala","2026-05-13","2026-05-15","Vacation"],["Arpit Rai","2026-05-04","2026-05-04","Vacation"],["Charu Singh","2026-05-04","2026-05-04","Sick"],["Akshay Dhote","2026-05-04","2026-05-04","Vacation"],["Shashikumar De","2026-05-04","2026-05-05","Comp-Off"],["Abhishek Pandey","2026-05-18","2026-05-19","Vacation"],["Vasupalli Jairam Kiran","2026-05-05","2026-05-05","Sick"],["Ataur Rahman","2026-05-05","2026-05-06","Sick"],["Ganesh D","2026-05-11","2026-05-14","Vacation"],["Mridul Mahajan","2026-05-06","2026-05-08","Comp-Off"],["Mehmood Ahmed Banthiya","2026-05-27","2026-05-29","Vacation"],["Pradeep Kumar N","2026-05-11","2026-05-11","Sick"],["Devesh Bhangle","2026-05-11","2026-05-11","Sick"],["Sathya Sai","2026-05-12","2026-05-12","Sick"],["Sukanya Ingole","2026-05-12","2026-05-12","Sick"],["Vikas Pawar","2026-05-25","2026-05-27","Vacation"],["Ramkrishna Raghuwanshi","2026-05-04","2026-05-08","Vacation"],["Vijay Pratap","2026-05-08","2026-05-08","Sick"],["Yuvasri Sankar","2026-05-13","2026-05-13","Sick"],["Devesh Bhangle","2026-07-16","2026-07-16","Vacation"],["Prerna","2026-05-14","2026-05-15","Comp-Off"],["Vikrant Dureja","2026-07-08","2026-07-10","Vacation"],["Vikrant Dureja","2026-06-10","2026-06-12","Vacation"],["Deepak G","2026-06-05","2026-06-05","Vacation"],["Abhishek Pandey","2026-05-27","2026-05-29","Vacation"],["Ajay Singh Thakur","2026-07-03","2026-07-10","Vacation"],["Ankit Giri","2026-04-27","2026-05-01","Vacation"],["Ankit Giri","2026-05-06","2026-05-06","Sick"],["Ankit Giri","2026-05-08","2026-05-08","Comp-Off"],["Naveen Teja","2026-05-13","2026-05-13","Sick"],["Ankit Giri","2026-06-19","2026-06-19","Comp-Off"],["Ankit Giri","2026-06-01","2026-06-01","Vacation"],["Prerna","2026-06-18","2026-06-19","Comp-Off"],["Deepak G","2026-07-17","2026-07-17","Vacation"],["Ankit Giri","2026-07-17","2026-07-17","Vacation"],["Shradha Chavan","2026-06-10","2026-06-10","Vacation"],["Shradha Chavan","2026-06-15","2026-06-17","Vacation"],["Vasupalli Jairam Kiran","2026-06-05","2026-06-05","Vacation"],["Vasupalli Jairam Kiran","2026-07-17","2026-07-17","Vacation"],["Riddhi Agarwal","2026-05-29","2026-05-29","Comp-Off"],["Riddhi Agarwal","2026-06-03","2026-06-05","Vacation"],["Akshay Bawankule","2026-06-15","2026-06-19","Vacation"],["Puja Jain","2026-06-29","2026-07-01","Vacation"],["Amit Jain(L)","2026-05-15","2026-05-15","Vacation"],["Amit Jain(L)","2026-07-08","2026-07-15","Vacation"],["Sumit Gurav","2026-05-29","2026-05-29","Comp-Off"],["Sanjay Verma","2026-06-22","2026-06-26","Vacation"],["Gaurav Jain","2026-07-14","2026-07-18","Vacation"],["Manmeet","2026-05-28","2026-05-29","Vacation"],["Charu Singh","2026-06-01","2026-06-05","Vacation"],["Abhishek Chauhan","2026-06-05","2026-06-05","Comp-Off"],["Abhishek Chauhan","2026-06-19","2026-06-22","Vacation"],["Momi Ahmed","2026-05-14","2026-05-14","Sick"],["Sachit Misra","2026-05-15","2026-05-22","Vacation"],["Udaykumar Patel","2026-05-27","2026-05-27","Vacation"],["Sukanya Ingole","2026-07-02","2026-07-03","Vacation"],["Sukanya Ingole","2026-07-06","2026-07-06","Vacation"],["Sukanya Ingole","2026-06-12","2026-06-12","Vacation"],["Vikas Pawar","2026-07-16","2026-07-17","Vacation"],["Lakshmitha H N","2026-06-12","2026-06-12","Vacation"],["Anand Shirahatti","2026-05-14","2026-05-14","Sick"],["Megha Gaikwad","2026-05-15","2026-05-15","Sick"],["Sandeep Tarte","2026-05-15","2026-05-15","Sick"],["Shivam Chauhan","2026-06-17","2026-06-19","Vacation"],["Ataur Rahman","2026-05-14","2026-05-14","Vacation"],["Abhishek Kumar","2026-05-11","2026-05-11","Comp-Off"],["Shivam Gouri","2026-06-03","2026-06-03","Vacation"],["Shivam Gouri","2026-05-22","2026-05-22","Vacation"],["Shivam Gouri","2026-05-28","2026-05-29","Vacation"],["Shivam Gouri","2026-06-04","2026-06-05","Vacation"],["Omkar Ganpati Patil","2026-05-07","2026-05-07","Vacation"],["Mehmood Ahmed Banthiya","2026-05-26","2026-05-26","Vacation"],["Amrish Yashpal","2026-05-25","2026-05-25","Vacation"],["Amrish Yashpal","2026-06-22","2026-06-24","Vacation"],["Mejari Kumar","2026-07-20","2026-07-20","Vacation"],["Ramkrishna Raghuwanshi","2026-06-15","2026-06-15","Vacation"],["Ramkrishna Raghuwanshi","2026-07-22","2026-07-22","Vacation"],["Sandeep Tarte","2026-06-18","2026-06-22","Vacation"],["Sandeep Tarte","2026-06-29","2026-06-30","Vacation"],["Sandeep Tarte","2026-07-13","2026-07-15","Vacation"],["Shivpratap Chouhan","2026-06-17","2026-06-19","Vacation"],["Shivpratap Chouhan","2026-07-13","2026-07-17","Vacation"],["Mridul Mahajan","2026-05-11","2026-05-12","Vacation"],["Yogendra Reddy","2026-05-18","2026-05-18","Vacation"],["Abhishek Pandey","2026-07-16","2026-07-17","Vacation"],["Sourabh Maji","2026-05-18","2026-05-18","Sick"],["Bhargavi V","2026-05-07","2026-05-07","Sick"],["Bhargavi V","2026-05-11","2026-05-11","Sick"],["Bhargavi V","2026-05-15","2026-05-15","Sick"],["Bhargavi V","2026-05-18","2026-05-22","Sick"],["Chaitanya Kuthiala","2026-05-18","2026-05-22","Vacation"],["Umag Soni","2026-06-19","2026-06-19","Vacation"],["Umag Soni","2026-07-02","2026-07-03","Vacation"],["Mounika J","2026-05-15","2026-05-15","Sick"],["Mounika J","2026-05-18","2026-05-19","Vacation"],["Shradha Chavan","2026-05-21","2026-05-22","Sick"],["Akshay Jain","2026-05-18","2026-05-18","Comp-Off"],["Heena Mittal","2026-05-15","2026-05-15","Half Day"],["Charu Singh","2026-05-18","2026-05-18","Vacation"],["Anand Shirahatti","2026-05-22","2026-05-22","Sick"],["Lakshmitha H N","2026-05-22","2026-05-22","Sick"],["Nitin Kumar Agarwal","2026-05-13","2026-05-13","Sick"],["Mounika J","2026-05-22","2026-05-22","Sick"],["Abhishek Kumar","2026-05-20","2026-05-20","Vacation"],["Sathya Sai","2026-05-25","2026-05-25","Sick"],["Talasila Yogananda Krishna","2026-06-03","2026-06-03","Vacation"],["Arpit Rai","2026-05-25","2026-05-25","Sick"],["Aman Bharti","2026-05-21","2026-05-21","Vacation"],["Devesh Bhangle","2026-05-25","2026-05-25","Sick"],["Ataur Rahman","2026-05-25","2026-05-25","Sick"],["Maitreya Arun Tayde","2026-05-21","2026-05-21","Vacation"],["Sandeep Tarte","2026-05-18","2026-05-18","Vacation"],["Ashita Sharma","2026-05-25","2026-05-25","Sick"],["Arpit Rai","2026-05-27","2026-05-27","Sick"],["Chaitanya Kuthiala","2026-05-25","2026-05-29","Vacation"],["Bhargavi V","2026-05-25","2026-05-29","Sick"],["Momi Ahmed","2026-05-28","2026-05-28","Sick"],["Ataur Rahman","2026-05-28","2026-05-28","Vacation"],["Ataur Rahman","2026-05-26","2026-05-26","Sick"],["Sanjay Verma","2026-05-26","2026-05-26","Sick"],["Ashita Sharma","2026-05-26","2026-05-26","Sick"],["Aniket Sambhaji","2026-05-28","2026-05-28","Vacation"],["Gaurav Jain","2026-06-15","2026-06-16","Comp-Off"],["Mounika J","2026-05-25","2026-05-26","Unpaid"],["Sathya Sai","2026-05-29","2026-05-29","Sick"],["Ataur Rahman","2026-05-29","2026-05-29","Vacation"],["Abhishek Agarwal","2026-05-28","2026-05-29","Vacation"],["Ashu Gupta","2026-05-28","2026-05-29","Vacation"],["Rishimaan Shukla","2026-05-28","2026-05-28","Vacation"],["Sandeep Tarte","2026-05-25","2026-05-25","Vacation"],["Devashish Sakesna","2026-05-29","2026-05-29","Comp-Off"],["Kavin Kumaar PB","2026-05-28","2026-05-28","Vacation"],["Tarun Teja","2026-05-25","2026-05-25","Comp-Off"],["Tarun Teja","2026-05-28","2026-05-28","Comp-Off"],["Yuvasri Sankar","2026-06-05","2026-06-08","Vacation"],["Lakshmitha H N","2026-06-01","2026-06-01","Sick"],["Sourav Mallick","2026-06-01","2026-06-01","Sick"],["Rohit Choudhary","2026-06-01","2026-06-01","Vacation"],["Ritish Ghosh","2026-06-01","2026-06-01","Sick"],["Tarun Teja","2026-06-01","2026-06-01","Comp-Off"],["Mehmood Ahmed Banthiya","2026-06-02","2026-06-05","Vacation"],["Brahadish Balakrishnan","2026-06-02","2026-06-03","Sick"],["Naga Kartheek Yejandla","2026-06-03","2026-06-03","Sick"],["Ataur Rahman","2026-06-02","2026-06-02","Vacation"],["Mridul Mahajan","2026-06-04","2026-06-05","Vacation"],["Ramsharan Prajapati","2026-06-04","2026-06-04","Sick"],["Mounika J","2026-06-01","2026-06-05","Sick"],["Bhargavi V","2026-06-01","2026-06-05","Sick"],["Shivpratap Chouhan","2026-06-04","2026-06-05","Vacation"],["Devashish Sakesna","2026-06-05","2026-06-05","Comp-Off"],["Sourav Mallick","2026-06-08","2026-06-08","Sick"],["Megha Gaikwad","2026-06-08","2026-06-08","Sick"],["Omkar Ganpati Patil","2026-06-05","2026-06-05","Sick"],["Soloman Kumar","2026-06-08","2026-06-08","Sick"],["Lakshmitha H N","2026-06-08","2026-06-08","Sick"],["Ajay Singh Thakur","2026-06-02","2026-06-05","Vacation"],["Manmeet","2026-06-01","2026-06-01","Vacation"],["Prerna","2026-06-02","2026-06-02","Comp-Off"],["Sachit Misra","2026-06-05","2026-06-05","Vacation"],["Sijo Saji","2026-06-05","2026-06-05","Vacation"],["Vijay Pratap","2026-06-01","2026-06-01","Vacation"],["Rahul Masule","2026-06-02","2026-06-03","Vacation"],["Sudha Basavaraja","2026-06-01","2026-06-02","Vacation"],["Sourabh Maji","2026-06-04","2026-06-04","Vacation"],["Yuvasri Sankar","2026-06-09","2026-06-09","Sick"],["Ataur Rahman","2026-06-08","2026-06-09","Vacation"],["Mehmood Ahmed Banthiya","2026-06-08","2026-06-09","Vacation"]],"C":[["Akshay Jain","2026-04-25",0.5,""],["Akshay Jain","2026-04-26",1.0,""],["Relli Raghunadha","2026-05-01",1.0,"Comp off for 13th May"],["Kavin Kumaar PB","2026-03-21",1.0,""],["Pushpak","2026-03-21",1.0,""],["Sanchit Kapoor","2026-03-21",1.0,""],["Mridul Mahajan","2026-03-21",1.0,""],["Devashish Sakesna","2026-03-21",1.0,""],["Kavin Kumaar PB","2026-03-22",1.0,""],["Abhishek Kumar","2026-03-22",1.0,""],["Sanchit Kapoor","2026-03-22",1.0,""],["Mridul Mahajan","2026-03-22",1.0,""],["Devashish Sakesna","2026-03-22",1.0,""],["Kavin Kumaar PB","2026-03-28",1.0,""],["Abhishek Kumar","2026-03-28",1.0,""],["Tarun Teja","2026-03-28",1.0,""],["Manmeet","2026-03-29",1.0,""],["Kavin Kumaar PB","2026-03-29",1.0,""],["Tarun Teja","2026-03-29",1.0,""],["Devashish Sakesna","2026-03-28",1.0,""],["Devashish Sakesna","2026-03-29",1.0,""],["Prerna","2026-03-28",1.0,""],["Naga Kartheek Yejandla","2026-03-29",1.0,""],["Abhishek Kumar","2026-04-03",1.0,""],["Tarun Teja","2026-04-03",1.0,""],["Kavin Kumaar PB","2026-04-03",1.0,""],["Sanchit Kapoor","2026-04-03",1.0,""],["Abhishek Kumar","2026-04-04",1.0,""],["Tarun Teja","2026-04-04",1.0,""],["Kavin Kumaar PB","2026-04-04",1.0,""],["Sanchit Kapoor","2026-04-04",1.0,""],["Tarun Teja","2026-04-05",1.0,""],["Kavin Kumaar PB","2026-04-05",1.0,""],["Sanchit Kapoor","2026-04-05",1.0,""],["Mridul Mahajan","2026-04-03",0.5,""],["Abhishek Chauhan","2026-04-03",1.0,""],["Akshay Jain","2026-04-03",1.0,""],["Sachit Misra","2026-04-03",1.0,""],["Mridul Mahajan","2026-04-04",1.0,""],["Abhishek Chauhan","2026-04-04",1.0,""],["Sachit Misra","2026-04-05",1.0,""],["Mridul Mahajan","2026-04-05",1.0,""],["Abhishek Chauhan","2026-04-05",1.0,""],["Abhishek Kumar","2026-04-11",1.0,""],["Pushpak","2026-04-11",1.0,""],["Sanchit Kapoor","2026-04-11",1.0,""],["Prerna","2026-04-11",1.0,""],["Sijo Saji","2026-04-11",1.0,""],["Sachit Misra","2026-04-11",1.0,""],["Abhishek Kumar","2026-04-12",1.0,""],["Kavin Kumaar PB","2026-04-12",1.0,""],["Manmeet","2026-04-12",1.0,""],["Naga Kartheek Yejandla","2026-04-12",1.0,""],["Sijo Saji","2026-04-12",1.0,""],["Akshay Jain","2026-04-12",1.0,""],["Sanchit Kapoor","2026-04-18",1.0,""],["Abhishek Kumar","2026-04-18",1.0,""],["Tarun Teja","2026-04-18",1.0,""],["Prerna","2026-04-18",1.0,""],["Sijo Saji","2026-04-18",1.0,""],["Sachit Misra","2026-04-18",1.0,""],["Devashish Sakesna","2026-04-18",1.0,""],["Ankit Giri","2026-04-18",1.0,""],["Manmeet","2026-04-19",1.0,""],["Abhishek Kumar","2026-04-19",1.0,""],["Tarun Teja","2026-04-19",1.0,""],["Mridul Mahajan","2026-04-19",1.0,""],["Devashish Sakesna","2026-04-19",1.0,""],["Sijo Saji","2026-04-19",1.0,""],["Akshay Jain","2026-04-19",1.0,""],["Ankit Giri","2026-04-19",1.0,""],["Utkarsh Jha","2026-04-25",1.0,""],["Tarun Teja","2026-04-25",1.0,""],["Pushpak","2026-04-25",1.0,""],["Devashish Sakesna","2026-04-25",1.0,""],["Abhishek Chauhan","2026-04-25",1.0,""],["Riddhi Agarwal","2026-04-25",1.0,""],["Utkarsh Jha","2026-04-26",1.0,""],["Tarun Teja","2026-04-26",1.0,""],["Mridul Mahajan","2026-04-26",1.0,""],["Devashish Sakesna","2026-04-26",1.0,""],["Abhishek Chauhan","2026-04-26",1.0,""],["Tarun Teja","2026-05-01",1.0,""],["Abhishek Chauhan","2026-05-02",1.0,""],["Prerna","2026-05-02",1.0,""],["Pushpak","2026-05-02",1.0,""],["Abhishek Chauhan","2026-05-03",1.0,""],["Manmeet","2026-05-03",1.0,""],["Mridul Mahajan","2026-05-03",1.0,""],["Gaurav Jain","2026-04-11",1.0,""],["Sanchit Kapoor","2026-05-09",1.0,""],["Abhishek Kumar","2026-05-09",1.0,""],["Sijo Saji","2026-05-09",1.0,""],["Devashish Sakesna","2026-05-10",1.0,""],["Utkarsh Jha","2026-05-10",1.0,""],["Pushpak","2026-05-10",1.0,""],["Sumit Gurav","2026-04-18",1.0,""],["Sumit Gurav","2026-04-19",1.0,""],["Gaurav Jain","2026-05-16",0.5,""]],"T":[["Abhishek Agarwal","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Abhishek Chauhan","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Abhishek Kumar","R1","",[["Chased","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Abhishek Pandey","R2","",[["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Aditya Sangar","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ajay Singh Thakur","R2","SF to be updated from backend for 1st Jun",[["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Not Updated","Not Updated"],["",""]]],["Akshay Bawankule","R2","",[["N/A","N/A"],["N/A","Proactive"],["N/A","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Akshay Jain","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Akshay Kapoor","R2","",[["Chased","N/A"],["Beyond Monday","N/A"],["Proactive","N/A"],["Proactive","Proactive"],["N/A","N/A"],["Chased","Chased"],["Chased","Chased"],["Proactive","Proactive"],["",""]]],["Aman Bharti","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Amit Jain(L)","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Chased"],["",""]]],["Amrish Yashpal","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Anand Shirahatti","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Aniket Sambhaji","R2","",[["Beyond Monday","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["",""]]],["Ankit Giri","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Arpit Rai","R2","",[["Not Updated","Beyond Monday"],["Beyond Monday","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ashita Sharma","R2","",[["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ashu Gupta","R1","",[["Chased","N/A"],["Proactive","N/A"],["Proactive","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Chased"],["Chased","Chased"],["",""]]],["Ataur Rahman","R2","",[["Beyond Monday","Beyond Monday"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["Proactive","Proactive"],["",""]]],["Bhargavi V","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["",""]]],["Brahadish Balakrishnan","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Chaitanya Kuthiala","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Beyond Monday"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["Chased","Chased"],["",""]]],["Charu Singh","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["N/A","N/A"],["",""]]],["Christopher Niklowoski","R2","",[["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["",""]]],["Deepak G","R2","",[["N/A","N/A"],["N/A","Chased"],["N/A","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Devashish Sakesna","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Devesh Bhangle","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Dushyant Sharma","R2","",[["Proactive","N/A"],["Proactive","N/A"],["Proactive","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["",""]]],["Chittineni Gaurav","R2","",[["Chased","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Gaurav Jain","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Heena Mittal","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Himanshu Mishra","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Hunny Pal","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Jagpreet Singh","R2","",[["Proactive","N/A"],["Proactive","N/A"],["Proactive","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Kavin Kumaar PB","R1","",[["Proactive","Chased"],["Beyond Monday","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Lakshmitha H N","R2","",[["",""],["",""],["N/A","N/A"],["Chased","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["",""]]],["Laszlo Guylas","R2","",[["Chased","Not Updated"],["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["",""]]],["Lazar Dukic","R2","",[["N/A","N/A"],["Proactive","Proactive"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["",""]]],["Maitreya Arun Tayde","R2","",[["Proactive","Not Updated"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Manmeet","R1","",[["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Megha Gaikwad","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Mehmood Ahmed Banthiya","R2","JIRA to be updated for 1st June",[["N/A","N/A"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Not Updated"],["",""]]],["Mejari Kumar","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Momi Ahmed","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Mounika J","R2","JIRA to be updated",[["",""],["",""],["N/A","N/A"],["Chased","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Not Updated"],["",""]]],["Mridul Mahajan","R1","",[["Proactive","Beyond Monday"],["Proactive","Chased"],["Proactive","Partial Updated"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Naga Kartheek Yejandla","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Nitin Kumar Agarwal","R2","",[["Proactive","Chased"],["Proactive","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Omkar Ganpati Patil","R2","",[["Proactive","Beyond Monday"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Prerna","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Puja Jain","R2","",[["Chased","Proactive"],["Beyond Monday","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Pushpak","R1","",[["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Rahul Masule","R2","",[["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ramkrishna Raghuwanshi","R2","",[["Not Updated","Proactive"],["N/A","Chased"],["N/A","Proactive"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ramsharan Prajapati","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Relli Raghunadha","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Riddhi Agarwal","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["",""]]],["Rishimaan Shukla","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Ritish Ghosh","R2","",[["Beyond Monday","Not Updated"],["Proactive","Not Updated"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Rohit Choudhary","R2","",[["Chased","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Proactive"],["",""]]],["Sachit Misra","R2","",[["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Partial Updated"],["Proactive","Proactive"],["Proactive","Proactive"],["N/A","N/A"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Samriti Arora","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Partial Updated"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Sanchit Kapoor","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Partial Updated"],["Proactive","Chased"],["Proactive","Proactive"],["Chased","Chased"],["Chased","Chased"],["Proactive","Proactive"],["",""]]],["Sandeep Tarte","R2","",[["Beyond Monday","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Sanjay Verma","R2","",[["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Santhosh Kashyap","R2","",[["Beyond Monday","Not Updated"],["Proactive","Not Updated"],["Proactive","Proactive"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["N/A","N/A"],["",""]]],["Shashikumar De","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["",""]]],["Shivam Chauhan","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Shivam Gouri","R2","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Shivpratap Chouhan","R2","",[["Proactive","Beyond Monday"],["Partial Updated","Not Updated"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Shradha Chavan","R2","",[["Beyond Monday","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Sijo Saji","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Partial Updated"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Soloman Kumar","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Sourabh Maji","R2","",[["N/A","N/A"],["Not Updated","Not Updated"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Sourav Mallick","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Sudha Basavaraja","R2","",[["Proactive","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Sukanya Ingole","R2","",[["N/A","N/A"],["Not Updated","Not Updated"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["",""]]],["Sumit Gurav","R2","",[["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Chased"],["",""]]],["Suprakash Samantaray","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Tarun Teja","R1","",[["Proactive","Beyond Monday"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Udaykumar Patel","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Umag Soni","R2","",[["Proactive","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Utkarsh Jha","R1","",[["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["",""]]],["Vijay Pratap","R2","",[["Proactive","Chased"],["Proactive","Proactive"],["Proactive","Proactive"],["Chased","Chased"],["Proactive","Proactive"],["Proactive","Chased"],["Proactive","Chased"],["Proactive","Proactive"],["",""]]],["Vikas Pawar","R2","",[["Chased","Chased"],["Proactive","Beyond Monday"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Vikrant Dureja","R1","",[["Proactive","N/A"],["Proactive","N/A"],["Proactive","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Yogendra Reddy","R2","",[["N/A","N/A"],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]],["Yuvasri Sankar","R2","",[["",""],["",""],["N/A","N/A"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["Proactive","Proactive"],["",""]]]],"W":["2026-04-12","2026-04-19","2026-04-26","2026-05-03","2026-05-10","2026-05-17","2026-05-24","2026-05-31","2026-06-07"],"H":["2026-01-01","2026-01-26","2026-03-04","2026-04-03","2026-05-01","2026-05-27","2026-08-28","2026-09-04","2026-10-02","2026-10-20","2026-11-09","2026-11-24","2026-12-25"],"A":[["Dushyant Sharma","PM","2026-03-01",null],["Gaurav Jain","Refactoring","2026-03-01",null]],"P":[["Shivpratap Chouhan","2026-04-10",[1.0,1.0,4.0,2.0,5.0,4.0]],["Darsiguntla Venkatapullaiah","2026-04-17",[1.0,1.0,1.0,2.0,1.0,1.0]],["Shivpratap Chouhan","2026-04-17",[3.0,2.0,3.0,2.0,5.0,4.0]],["Bharathi K","2026-04-24",[1.0,1.0,1.0,1.0,1.0,1.0]],["Darsiguntla Venkatapullaiah","2026-04-24",[2.0,1.0,1.0,2.0,1.0,2.0]],["Sourabh Maji","2026-04-24",[1.0,1.0,1.0,1.0,1.0,1.0]],["Talasila Yogananda Krishna","2026-04-24",[3.0,2.0,4.0,2.0,3.0,3.0]],["Bharathi K","2026-04-30",[2.0,1.0,2.0,1.0,3.0,1.0]],["Naveen Teja","2026-04-30",[1.0,0.0,1.0,1.0,1.0,2.0]],["Pradeep Kumar N","2026-04-30",[2.0,1.0,2.0,2.0,1.0,2.0]],["Sai Kiran","2026-04-30",[1.0,1.0,0.0,1.0,1.0,1.0]],["Sourabh Maji","2026-04-30",[2.0,2.0,1.0,2.0,1.0,3.0]],["Sukanya Ingole","2026-04-30",[3.0,3.0,4.0,3.0,4.0,4.0]],["Talasila Yogananda Krishna","2026-04-30",[3.0,2.0,4.0,2.0,5.0,4.0]],["Akshay Bawankule","2026-05-01",[null,null,null,null,null,null]],["Anand Shirahatti","2026-05-01",[4.0,4.0,4.0,3.0,4.0,4.0]],["Hunny Pal","2026-05-01",[3.0,3.0,4.0,3.0,4.0,4.0]],["Maitreya Arun Tayde","2026-05-01",[3.0,3.0,3.0,3.0,3.0,4.0]],["Omkar Ganpati Patil","2026-05-01",[3.0,3.0,3.0,3.0,4.0,4.0]],["Prathibha S N","2026-05-01",[3.0,3.0,3.0,3.0,3.0,3.0]],["Sandeep Tarte","2026-05-01",[3.0,4.0,3.0,4.0,5.0,5.0]],["Sudha Basavaraja","2026-05-01",[3.0,3.0,2.0,4.0,5.0,3.0]],["Umag Soni","2026-05-01",[3.0,3.0,4.0,4.0,3.0,3.0]],["Dheeraj Mamdamanchi","2026-05-02",[3.0,3.0,3.0,3.0,3.0,4.0]],["Chittineni Gaurav","2026-05-03",[3.0,3.0,2.0,3.0,3.0,4.0]],["Reli","2026-05-04",[4.0,4.0,4.0,4.0,4.0,4.0]],["Sourabh Maji","2026-05-04",[3.0,3.0,2.0,2.0,2.0,3.0]],["Talasila Yogananda Krishna","2026-05-04",[3.0,1.0,2.0,2.0,5.0,3.0]],["Vikas Pawar","2026-05-04",[null,null,null,null,null,null]],["Ashita Sharma","2026-05-08",[5.0,4.0,5.0,5.0,4.0,5.0]],["Sourabh Maji","2026-05-11",[3.0,2.0,2.0,3.0,2.0,3.0]],["Talasila Yogananda Krishna","2026-05-11",[3.0,1.0,2.0,2.0,5.0,3.0]],["Aniket Sambhaji","2026-05-18",[1.0,2.0,1.0,0.0,1.0,0.0]],["Arpit Rai","2026-05-18",[3.0,3.0,4.0,4.0,2.0,4.0]],["Deepak G","2026-05-18",[4.0,5.0,5.0,5.0,4.0,5.0]],["Ganesh D","2026-05-18",[2.0,2.0,3.0,3.0,3.0,3.0]],["Megha Gaikwad","2026-05-18",[4.0,4.0,3.0,4.0,4.0,4.0]],["Naveen Teja","2026-05-18",[1.0,0.0,2.0,1.0,1.0,2.0]],["Pradeep Kumar N","2026-05-18",[2.0,2.0,1.0,2.0,2.0,1.0]],["Ram Sharan","2026-05-18",[4.0,5.0,5.0,5.0,4.0,5.0]],["Rishimaan Shukla","2026-05-18",[3.0,3.0,2.0,3.0,3.0,3.0]],["Sathya Sai","2026-05-18",[3.0,3.0,2.0,3.0,3.0,3.0]],["Shradha Chavan","2026-05-18",[4.0,4.0,3.0,3.0,3.0,2.0]],["Vasupalli Jairam Kiran","2026-05-18",[1.0,1.0,1.0,1.0,0.0,0.0]],["Yogendra Reddy","2026-05-18",[3.0,3.0,3.0,3.0,3.0,2.0]],["Yuvasri Sankar","2026-05-18",[5.0,4.0,5.0,5.0,4.0,5.0]],["Aniket Sambhaji","2026-05-25",[3.0,3.0,4.0,3.0,4.0,4.0]],["Arpit Rai","2026-05-25",[3.0,3.0,4.0,4.0,4.0,4.0]],["Ashita Sharma","2026-05-25",[5.0,4.0,5.0,5.0,5.0,5.0]],["Deepak G","2026-05-25",[4.0,5.0,5.0,5.0,4.0,5.0]],["Dheeraj Mamdamanchi","2026-05-25",[2.0,2.0,3.0,2.0,2.0,2.0]],["Ganesh D","2026-05-25",[2.0,2.0,2.0,2.0,2.0,4.0]],["Megha Gaikwad","2026-05-25",[4.0,4.0,3.0,4.0,4.0,4.0]],["Ram Sharan","2026-05-25",[4.0,5.0,5.0,5.0,4.0,5.0]],["Rishimaan Shukla","2026-05-25",[3.0,3.0,3.0,3.0,3.0,3.0]],["Sathya Sai","2026-05-25",[3.0,2.0,2.0,2.0,3.0,3.0]],["Shradha Chavan","2026-05-25",[4.0,4.0,4.0,4.0,3.0,4.0]],["Vasupalli Jairam Kiran","2026-05-25",[2.0,3.0,3.0,3.0,3.0,4.0]],["Yogendra Reddy","2026-05-25",[3.0,3.0,3.0,3.0,3.0,4.0]],["Yuvasri Sankar","2026-05-25",[5.0,4.0,5.0,5.0,4.0,5.0]]]};

// ============================================================
// MONGODB BRAND (palette from mongodb.com / LeafyGreen design system)
// slate #001E2B · spring green #00ED64 · forest #00684A · evergreen #023430 · mist #E3FCF7
// ============================================================
const BRAND_FONT = '"DM Sans", "Euclid Circular A", "Helvetica Neue", Helvetica, Arial, sans-serif';
const BRAND_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
.mdb-btn-primary{background:#00684A;}
.mdb-btn-primary:hover:not(:disabled){background:#023430;}
.mdb-btn-primary:disabled{background:#94a3b8;}
.mdb-nav-active{background:#E3FCF7;color:#00684A;box-shadow:inset 3px 0 0 #00ED64;}
.mdb-role-active{background:#001E2B;border-color:#001E2B;color:#fff;}
.mdb-bar{background:#00684A;}
.mdb-dot-spring{background:#00ED64;}
.mdb-input:focus{border-color:#00684A;box-shadow:0 0 0 3px #E3FCF7;outline:none;}
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .no-print { display: none !important; }
}
`;
function Leaf({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#00ED64" d="M12 1.6c-3.4 5-4.3 10-3.1 14.3.8 3 2.3 5 2.7 6.1.1.3.7.3.8 0 .4-1.1 1.9-3.1 2.7-6.1C16.3 11.6 15.4 6.6 12 1.6z" />
      <path fill="#023430" opacity="0.45" d="M11.7 22h.6v-9.5h-.6z" />
    </svg>
  );
}

// ============================================================
// BUSINESS LOGIC (pure functions)
// ============================================================
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function fmt(s) {
  if (!s) return "—";
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(s) {
  const d = parseISO(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function isWeekend(d, weekendDays) {
  return weekendDays.includes(d.getDay());
}
function isWorkingDay(d, weekendDays, holidaySet) {
  return !isWeekend(d, weekendDays) && !holidaySet.has(toISO(d));
}
// counts working days in [start, end] and multiplies by the leave type's day value
function leaveDays(startISO, endISO, typeName, leaveTypes, weekendDays, holidaySet) {
  const value = (leaveTypes.find((t) => t.name === typeName) || { value: 1 }).value;
  let d = parseISO(startISO);
  const end = parseISO(endISO);
  let n = 0;
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n * value;
}
function isDuplicate(leaves, entry) {
  return leaves.some(
    (l) => l.name === entry.name && l.start === entry.start && l.end === entry.end && l.type === entry.type
  );
}
function findOverlaps(leaves, entry, ignoreId) {
  return leaves.filter(
    (l) =>
      l.id !== ignoreId &&
      l.name === entry.name &&
      l.start <= entry.end &&
      entry.start <= l.end
  );
}
function compOffDateValid(dateISO, weekendDays, holidaySet) {
  const d = parseISO(dateISO);
  return isWeekend(d, weekendDays) || holidaySet.has(dateISO);
}
function balancesFor(name, leaves, comps, leaveTypes, weekendDays, holidaySet) {
  const byType = {};
  leaveTypes.forEach((t) => (byType[t.name] = 0));
  leaves
    .filter((l) => l.name === name)
    .forEach((l) => {
      const d = leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet);
      byType[l.type] = (byType[l.type] || 0) + d;
    });
  const earned = comps.filter((c) => c.name === name).reduce((s, c) => s + Number(c.days), 0);
  const used = byType["Comp-Off"] || 0;
  return { byType, compOffEarned: earned, compOffUsed: used, compOffBalance: earned - used };
}
// employee active during [rangeStart, rangeEnd]? (start before range ends, end date not before range starts)
function isActiveDuring(e, rangeStart, rangeEnd) {
  return (!e.start || e.start <= rangeEnd) && (!e.term || e.term >= rangeStart);
}
// working days of a leave that fall inside [rangeStart, rangeEnd] (for month-clipped reports)
function leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet) {
  const s = l.start > rangeStart ? l.start : rangeStart;
  const e = l.end < rangeEnd ? l.end : rangeEnd;
  if (s > e) return 0;
  return leaveDays(s, e, l.type, leaveTypes, weekendDays, holidaySet);
}
function onLeaveOn(dateISO, leaves) {
  return leaves.filter((l) => l.start <= dateISO && dateISO <= l.end);
}
// timecard stats for one row: weeks = [[sf,jira],...]
function tcStats(weeks) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira]) =>
    [sf, jira].forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    })
  );
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}
function weekCompliance(rows, weekIdx) {
  let pro = 0, filled = 0;
  rows.forEach((r) =>
    r.weeks[weekIdx].forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    })
  );
  return filled ? Math.round((pro / filled) * 100) : null;
}
// name spelling variants seen across the source trackers -> canonical master names
const NAME_ALIASES = {
  "Devashish Saksena": "Devashish Sakesna",
  "Amit Jain": "Amit Jain(L)",
  "Aniket Sambhaji Patil": "Aniket Sambhaji",
  "Chaitanya Kuthiyala": "Chaitanya Kuthiala",
  "Christopher Niklowoski*": "Christopher Niklowoski",
  "Gaurav Chittineni": "Chittineni Gaurav",
  "Lazar Dukic*": "Lazar Dukic",
};
// Excel cell (Date | serial number | string) -> "YYYY-MM-DD" | null
function excelToISO(v) {
  if (v === null || v === undefined || v === "") return null;
  let ms;
  if (v instanceof Date) ms = v.getTime();
  else if (typeof v === "number") ms = Math.round((v - 25569) * 86400000);
  else {
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = Date.parse(s);
    if (isNaN(t)) return null;
    ms = t;
  }
  const d = new Date(ms + 12 * 3600 * 1000); // noon shift tolerates timezone skew either way
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
}
// Parses the Timecard-Proactiveness sheet as array-of-arrays (header row 1: week dates
// from col F, merged over SF+JIRA pairs; row 2: SF/JIRA labels; data from row 3).
function parseTimecardGrid(grid) {
  const header = grid[0] || [];
  const weeks = [];
  for (let c = 5; c < header.length; c += 2) {
    const iso = excelToISO(header[c]);
    if (!iso) break;
    weeks.push({ col: c, iso });
  }
  const canon = {};
  TC_STATUSES.forEach((s) => (canon[s.toLowerCase()] = s));
  let unknownStatuses = 0;
  let duplicates = 0;
  const seen = new Set();
  const rows = [];
  for (let r = 2; r < grid.length; r++) {
    const raw = grid[r] || [];
    if (raw[0] === null || raw[0] === undefined || String(raw[0]).trim() === "") continue;
    const name0 = String(raw[0]).trim();
    const name = NAME_ALIASES[name0] || name0;
    if (seen.has(name)) { duplicates++; continue; }
    seen.add(name);
    const norm = (v) => {
      if (v === null || v === undefined) return "";
      const t = String(v).trim();
      if (!t) return "";
      const c2 = canon[t.toLowerCase()];
      if (c2 === undefined) { unknownStatuses++; return ""; }
      return c2;
    };
    rows.push({
      name,
      company: raw[1] ? String(raw[1]).trim() : "",
      release: raw[2] ? String(raw[2]).trim() : "",
      role: raw[3] ? String(raw[3]).trim() : "",
      remarks: raw[4] ? String(raw[4]).trim() : "",
      weeks: weeks.map((w) => [norm(raw[w.col]), norm(raw[w.col + 1])]),
    });
  }
  return { weeks: weeks.map((w) => w.iso), rows, unknownStatuses, duplicates };
}

// ---- Allocations: streams + date-range assignment logic ----
const STREAMS = ["Batches","Bugs","Code Optimisations","Code Quality","Database Maintainence","Database Objects","Leads","Miscellaneous Activities","New Integrations","PM","Post Production Support","Refactoring","Retrofitting","RIAM"];
const OPEN_END = "9999-12-31"; // null `to` = ongoing
// overlap is blocked only WITHIN the same project; cross-project concurrency is allowed (FTE splits evenly)
function aOverlaps(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId === entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}
function crossProjectConcurrent(assignments, entry, ignoreId) {
  const eEnd = entry.to || OPEN_END;
  return assignments.filter((a) => a.id !== ignoreId && a.name === entry.name && a.projectId !== entry.projectId && a.from <= eEnd && entry.from <= (a.to || OPEN_END));
}
function activeAssignmentsOn(assignments, name, iso) {
  return assignments.filter((a) => a.name === name && a.from <= iso && iso <= (a.to || OPEN_END));
}
// Day-weighted effort: for each working day in the month, a person's concurrent
// assignments share the day evenly (1/n each). Returns { assignmentId: weightedDays }.
function effortSplitInMonth(personAssignments, y, m, weekendDays, holidaySet) {
  const [ms, me] = monthRange(y, m);
  const out = {};
  let d = parseISO(ms);
  const end = parseISO(me);
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) {
      const iso = toISO(d);
      const act = personAssignments.filter((a) => a.from <= iso && iso <= (a.to || OPEN_END));
      if (act.length) {
        const w = 1 / act.length;
        act.forEach((a) => { out[a.id] = (out[a.id] || 0) + w; });
      }
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return out;
}
function workingDaysBetween(startISO, endISO, weekendDays, holidaySet) {
  let d = parseISO(startISO);
  const end = parseISO(endISO);
  let n = 0;
  while (d <= end) {
    if (isWorkingDay(d, weekendDays, holidaySet)) n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return n;
}
function monthRange(y, m) { // m: 1-12
  const p = (n) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return [y + "-" + p(m) + "-01", y + "-" + p(m) + "-" + p(last)];
}
// working days an assignment contributes inside a given month
function assignmentDaysInMonth(a, y, m, weekendDays, holidaySet) {
  const [ms, me] = monthRange(y, m);
  const s = a.from > ms ? a.from : ms;
  const e = (a.to || OPEN_END) < me ? a.to : me;
  if (s > e) return 0;
  return workingDaysBetween(s, e, weekendDays, holidaySet);
}
function streamsInMonth(assignments, name, y, m) {
  const [ms, me] = monthRange(y, m);
  return assignments
    .filter((a) => a.name === name && a.from <= me && ms <= (a.to || OPEN_END))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((a) => a.stream);
}
function currentStream(assignments, name, iso) {
  const a = assignments.find((x) => x.name === name && x.from <= iso && iso <= (x.to || OPEN_END));
  return a ? a.stream : null;
}

// timecard stats where JIRA counts only when the week's flag is true (project-level setting)
function tcStatsFlex(weeks, jiraFlags) {
  const s = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0, "N/A": 0, blank: 0, filled: 0 };
  weeks.forEach(([sf, jira], i) => {
    const cells = jiraFlags && jiraFlags[i] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (!v) s.blank++;
      else {
        s[v] = (s[v] || 0) + 1;
        if (v !== "N/A") s.filled++;
      }
    });
  });
  s.pct = s.filled ? Math.round((s.Proactive / s.filled) * 100) : null;
  return s;
}
function weekComplianceFlex(rows, weekIdx, flagsById) {
  let pro = 0, filled = 0;
  rows.forEach((r) => {
    const flags = flagsById && flagsById[r.id];
    const [sf, jira] = r.weeks[weekIdx] || ["", ""];
    const cells = flags && flags[weekIdx] === false ? [sf] : [sf, jira];
    cells.forEach((v) => {
      if (v && v !== "N/A") {
        filled++;
        if (v === "Proactive") pro++;
      }
    });
  });
  return filled ? Math.round((pro / filled) * 100) : null;
}
// timecard proactiveness % -> suggested performance metric (1-5)
function tcSuggested(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;
}
// ---- Performance scoring math (weights in %, must total 100) ----
const METRICS = ["Delivery", "Quality", "Communication", "Tech Skill", "Timecard", "Collaboration"];
function weightedScore(m, weights) {
  if (!m || m.length !== 6 || m.some((x) => x === null || x === undefined || x === "")) return null;
  const t = weights.reduce((s, w) => s + Number(w), 0) || 100;
  return m.reduce((s, x, i) => s + Number(x) * Number(weights[i]), 0) / t;
}
function starsOf(score) {
  return score === null ? null : Math.round(score * 2) / 2;
}
function ragOf(score, cfg) {
  return score === null ? null : score >= cfg.green ? "Green" : score >= cfg.amber ? "Amber" : "Red";
}
// effective app role: Lead Developer OR designated Stream Lead -> Lead
function appRoleForEmp(e) {
  if (e.viewer) return "Viewer"; // read-only persona, regardless of PS role
  if (e.role === "Project Manager") return "Project Manager";
  if (e.role === "Lead Developer" || e.streamLead) return "Lead";
  return "Developer";
}

// ---- Permission registry: module-level groups, capability-level entries, role defaults ----
// (D = Developer, L = Lead incl. Stream Leads, P = Project Manager; Admin always has everything)
const PERM_GROUPS = [
  { module: "Leave", caps: [
    ["leave.own", "Submit own leave · delete own entries", { D: 1, L: 1, P: 1, V: 0 }],
    ["leave.records", "View all leave records", { D: 0, L: 1, P: 1, V: 1 }],
    ["leave.forAnyone", "File / delete leave for anyone", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.compoff", "Log & manage comp-off earned", { D: 0, L: 1, P: 1, V: 0 }],
    ["leave.reports", "Leave reports (role / company / project totals)", { D: 0, L: 1, P: 1, V: 1 }],
    ["settings.edit", "Leave settings (types · weekends · holidays)", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Timecard", caps: [
    ["timecard.editAll", "Edit full grid · import weekly file · add weeks", { D: 0, L: 1, P: 1, V: 0 }],
    ["timecard.insights", "Timecard insights & compliance", { D: 0, L: 1, P: 1, V: 1 }],
  ]},
  { module: "Allocations & Projects", caps: [
    ["alloc.view", "View allocations (plan · roster · burn)", { D: 0, L: 1, P: 1, V: 1 }],
    ["alloc.edit", "Create / end / delete assignments", { D: 0, L: 1, P: 1, V: 0 }],
    ["projects.view", "View project master", { D: 0, L: 1, P: 1, V: 1 }],
    ["projects.manage", "Manage projects (names · phases · streams · JIRA setting)", { D: 0, L: 0, P: 1, V: 0 }],
    ["projects.raid", "Manage RAID log & milestones on projects", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Team Plans", caps: [
    ["plans.view", "View team plans & manage grid", { D: 0, L: 1, P: 1, V: 1 }],
    ["plans.manage", "Create / update / archive / delete team plans", { D: 0, L: 1, P: 1, V: 0 }],
  ]},
  { module: "Program Health", caps: [
    ["ph.view", "View program health (portfolio · weekly · pipeline)", { D: 0, L: 1, P: 1, V: 1 }],
    ["ph.register", "Edit PM-maintained project fields (stories · current margin · key update)", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.weekly", "Submit & edit weekly health entries", { D: 0, L: 0, P: 1, V: 0 }],
    ["ph.pipeline", "Manage the pipeline board", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "Performance", caps: [
    ["perf.view", "View performance · watchlist", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.score", "Enter & edit weekly scores", { D: 0, L: 1, P: 1, V: 0 }],
    ["perf.reports", "Performance reports & exports (Excel · PDF)", { D: 0, L: 1, P: 1, V: 1 }],
    ["perf.config", "Scoring configuration (weights · RAG · scope)", { D: 0, L: 0, P: 0, V: 0 }],
  ]},
  { module: "Runway", caps: [
    ["runway.view", "View remaining runway (weeks · days · last date)", { D: 0, L: 1, P: 1, V: 1 }],
    ["runway.funding", "Manage funding hours & remaining overrides", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
  { module: "People", caps: [
    ["employees.view", "View employee master", { D: 0, L: 1, P: 1, V: 1 }],
    ["employees.edit", "Edit employee master · Stream Leads · Viewers", { D: 0, L: 0, P: 1, V: 0 }],
  ]},
];
function defaultPerms() {
  const o = {};
  PERM_GROUPS.forEach((g) => g.caps.forEach(([id, _l, d]) => { o[id] = { Developer: !!d.D, Lead: !!d.L, "Project Manager": !!d.P, Viewer: !!d.V }; }));
  return o;
}
// stored permission docs from before a capability/role existed lack keys — merge defaults under them
function mergePerms(stored) {
  const base = defaultPerms();
  const out = {};
  Object.keys(base).forEach((cap) => { out[cap] = { ...base[cap], ...((stored || {})[cap] || {}) }; });
  return out;
}
function canDo(perms, role, cap) {
  if (role === "Admin") return true;
  const p = perms[cap];
  return p ? !!p[role] : false;
}
// ---- Performance report builders (pure, testable) ----
const PARTNER_COS = ["WeKan", "Ciklum", "Globant"];
function perfScorecard(employees, scores, week, cfg) {
  const pool = employees
    .filter((e) => isActiveDuring(e, week, week) && (cfg.partnerOnly ? PARTNER_COS.includes(e.company) : true))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = pool.map((e) => {
    const s = scores.find((x) => x.name === e.name && x.week === week);
    const sc = s ? weightedScore(s.m, cfg.weights) : null;
    return { name: e.name, vendor: e.company, m: s ? s.m : [null, null, null, null, null, null], score: sc, stars: starsOf(sc), rag: ragOf(sc, cfg) };
  });
  const vendors = {};
  rows.forEach((r) => {
    const v = (vendors[r.vendor] = vendors[r.vendor] || { total: 0, scored: 0, sum: 0, Green: 0, Amber: 0, Red: 0 });
    v.total++;
    if (r.score !== null) { v.scored++; v.sum += r.score; v[r.rag]++; }
  });
  Object.values(vendors).forEach((v) => { v.avg = v.scored ? v.sum / v.scored : null; });
  return { rows, vendors };
}
function perfVendorTrend(employees, scores, cfg) {
  const weeks = [...new Set(scores.map((s) => s.week))].sort();
  const coOf = Object.fromEntries(employees.map((e) => [e.name, e.company]));
  const grid = {}; // vendor -> { week -> {sum, n} }
  scores.forEach((s) => {
    const sc = weightedScore(s.m, cfg.weights);
    if (sc === null) return;
    const v = coOf[s.name] || "?";
    if (cfg.partnerOnly && !PARTNER_COS.includes(v)) return;
    const g = (grid[v] = grid[v] || {});
    const c = (g[s.week] = g[s.week] || { sum: 0, n: 0 });
    c.sum += sc; c.n++;
  });
  return { weeks, vendors: Object.fromEntries(Object.entries(grid).map(([v, g]) => [v, weeks.map((w) => (g[w] ? g[w].sum / g[w].n : null))])) };
}
function perfResourceTrend(scores, name, cfg) {
  return scores
    .filter((s) => s.name === name)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((s) => ({ week: s.week, m: s.m, score: weightedScore(s.m, cfg.weights) }))
    .map((x) => ({ ...x, stars: starsOf(x.score), rag: ragOf(x.score, cfg) }));
}
function downloadXlsx(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([name, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name.slice(0, 31)));
  XLSX.writeFile(wb, filename);
}

// ---- Remaining Runway engine ----
// Runway per role = remaining billable hours / weekly team burn, projected onto
// the calendar from the week anchor, extended by REAL approved leave (fixing the
// source sheet's broken WORKDAY usage where leave forecasts never took effect).
const RUNWAY_ROLES = ["PM", "LD", "SD", "Dev"];
function runwayRoleOf(psRole) {
  return psRole === "Project Manager" ? "PM" : psRole === "Lead Developer" ? "LD" : psRole === "Senior Developer" ? "SD" : "Dev";
}
function weekAnchor(todayISO) {
  // Excel: TODAY() - WEEKDAY(TODAY()) -> the most recent Saturday
  const d = parseISO(todayISO);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() - 1));
}
function addWorkingDays(startISO, n, weekendDays, holidaySet) {
  // Excel WORKDAY semantics: fraction truncated, start day not counted
  let remaining = Math.floor(n);
  const d = parseISO(startISO);
  let iso = startISO;
  let guard = 0;
  while (remaining > 0 && guard < 3000) {
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
    guard++;
    if (isWorkingDay(d, weekendDays, holidaySet)) remaining--;
  }
  return iso;
}
// consumed = 8h per working day per person, day-weighted across concurrent
// assignments, clipped to employment windows: { projectId: { role: hours } }
function consumedByProjectRole(assignments, empByName, fromISO, toISO2, weekendDays, holidaySet) {
  const out = {};
  if (!fromISO || fromISO > toISO2) return out;
  const byPerson = {};
  assignments.forEach((a) => { (byPerson[a.name] = byPerson[a.name] || []).push(a); });
  const d = parseISO(fromISO);
  let iso = fromISO;
  while (iso <= toISO2) {
    if (isWorkingDay(d, weekendDays, holidaySet)) {
      for (const name in byPerson) {
        const emp = empByName[name];
        if (emp && !isActiveDuring(emp, iso, iso)) continue;
        const acts = byPerson[name].filter((a) => a.from <= iso && iso <= (a.to || OPEN_END));
        if (!acts.length) continue;
        const share = 8 / acts.length;
        const role = runwayRoleOf(emp ? emp.role : "Developer");
        acts.forEach((a) => {
          const P = (out[a.projectId] = out[a.projectId] || {});
          P[role] = (P[role] || 0) + share;
        });
      }
    }
    d.setDate(d.getDate() + 1);
    iso = toISO(d);
  }
  return out;
}
function computeRunway(project, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO) {
  const f = project.funding;
  if (!f || !f.start) return null;
  const anchor = weekAnchor(todayISO);
  const consumed = (consumedByProjectRole(assignments, empByName, f.start, todayISO, weekendDays, holidaySet)[project.id]) || {};
  const active = assignments.filter((a) => a.projectId === project.id && a.from <= todayISO && todayISO <= (a.to || OPEN_END));
  const rows = RUNWAY_ROLES.map((role) => {
    const people = active.filter((a) => {
      const e = empByName[a.name];
      return e && isActiveDuring(e, todayISO, todayISO) && runwayRoleOf(e.role) === role;
    });
    const headcount = people.length;
    // forward burn must respect concurrent-project splits, exactly like consumption does:
    // a person active on N projects today contributes weeklyHours / N to each
    const weeklyBurn = people.reduce((s, a) => {
      const conc = assignments.filter((x) => x.name === a.name && x.from <= todayISO && todayISO <= (x.to || OPEN_END)).length || 1;
      return s + (Number(a.weeklyHours) || 40) / conc;
    }, 0);
    const total = Number((f.hours || {})[role]) || 0;
    const cons = Math.round((consumed[role] || 0) * 10) / 10;
    const rawOvr = f.overrides ? f.overrides[role] : null;
    const override = rawOvr === null || rawOvr === undefined || rawOvr === "" ? null : Number(rawOvr);
    const remaining = override !== null ? override : Math.max(0, total - cons);
    const weeks = weeklyBurn > 0 ? remaining / weeklyBurn : null;
    const days = weeks === null ? null : weeks * 5;
    let last = days === null ? null : addWorkingDays(anchor, days, weekendDays, holidaySet);
    let leaveAdj = 0;
    if (last && headcount) {
      const names = new Set(people.map((p) => p.name));
      const teamLeaves = leaves.filter((l) => names.has(l.name));
      for (let pass = 0; pass < 2; pass++) {
        const inWindow = teamLeaves.reduce((s, l) => s + leaveDaysInRange(l, anchor, last, leaveTypes, weekendDays, holidaySet), 0);
        const extra = Math.floor(inWindow) - Math.floor(leaveAdj);
        if (extra <= 0) { leaveAdj = inWindow; break; }
        last = addWorkingDays(last, extra, weekendDays, holidaySet);
        leaveAdj = inWindow;
      }
    }
    const rag = weeks === null ? null : weeks >= 4 ? "Green" : weeks >= 2 ? "Amber" : "Red";
    return { role, headcount, weeklyBurn, total, consumed: cons, remaining, override, weeks, days, last, leaveAdj, rag };
  });
  const withData = rows.filter((r) => r.last);
  const end = withData.length ? withData.reduce((m, r) => (r.last < m ? r.last : m), withData[0].last) : null;
  return { anchor, rows, end, totalRemaining: rows.reduce((s, r) => s + r.remaining, 0) };
}

// leave days in a window, attributed to projects (split evenly across a person's
// concurrent projects) and broken down by role — powers the Project × Role leave report
function leaveByProjectRole(leaves, empByName, assignments, fromISO, toISO2, leaveTypes, weekendDays, holidaySet) {
  const mk = () => ({ PM: 0, LD: 0, SD: 0, Dev: 0, total: 0 });
  const byProject = {};
  const unassigned = mk();
  const totals = mk();
  leaves.forEach((l) => {
    const days = leaveDaysInRange(l, fromISO, toISO2, leaveTypes, weekendDays, holidaySet);
    if (!days) return;
    const emp = empByName[l.name];
    const role = runwayRoleOf(emp ? emp.role : "Developer");
    totals[role] += days;
    totals.total += days;
    const pids = [...new Set(assignments.filter((a) => a.name === l.name && a.from <= toISO2 && fromISO <= (a.to || OPEN_END)).map((a) => a.projectId))];
    if (!pids.length) {
      unassigned[role] += days;
      unassigned.total += days;
      return;
    }
    const share = days / pids.length;
    pids.forEach((pid) => {
      const P = (byProject[pid] = byProject[pid] || mk());
      P[role] += share;
      P.total += share;
    });
  });
  return { byProject, unassigned, totals };
}

// ---- Program Health derivations (store raw facts; compute here) ----
function phElapsedPct(start, end, todayISO2) {
  if (!start || !end || end <= start) return null;
  return Math.round(((parseISO(todayISO2) - parseISO(start)) / (parseISO(end) - parseISO(start))) * 100) / 100;
}
function phEffortVar(planned, burnt) {
  const p = Number(planned) || 0;
  if (!p) return null;
  return Math.round(((Number(burnt) || 0) / p - 1) * 1000) / 1000;
}
function phBurnVsPlan(entries) {
  const P = entries.reduce((s, e) => s + (Number(e.hoursPlanned) || 0), 0);
  const B = entries.reduce((s, e) => s + (Number(e.hoursBurnt) || 0), 0);
  return P ? Math.round((B / P - 1) * 1000) / 1000 : null;
}
function phScheduleVar(totalStories, doneStories, elapsedPct) {
  const t = Number(totalStories) || 0;
  if (!t || elapsedPct === null) return { completion: t ? 0 : null, variance: null };
  const completion = Math.round(((Number(doneStories) || 0) / t) * 100) / 100;
  return { completion, variance: Math.round((completion - elapsedPct) * 100) / 100 };
}
function phHighRisks(raid, projectId) {
  return raid.filter((x) => x.projectId === projectId && x.status !== "Closed" && x.impact === "H").length;
}
const PH_STAGES = ["Exploratory", "POC", "Proposal", "MFW", "SOW Signed", "Closed"];

// slice rows for pagination — pure and testable
function pageSlice(rows, page, size) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const cur = Math.min(Math.max(1, page), pages);
  const from = (cur - 1) * size;
  return { slice: rows.slice(from, from + size), cur, pages, total, from: total ? from + 1 : 0, to: Math.min(from + size, total) };
}

// ---- Team Plan engine ----
// A plan targets project+phase over a month window. Rows = stream/label + task +
// #resources per month. Projected effort = resources × per-month multiplier
// (default 20 working days; overridable per month — the source sheet used ×15 for a
// partial July). Estimated effort is user-supplied per row; variance = projected − estimated.
function planMonths(startYm, count) {
  const [y, m] = startYm.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
}
function planCalc(plan) {
  const count = Number(plan.monthsCount) || 0;
  const ovr = plan.multOverrides || {};
  const multFor = (i) => (ovr[i] === null || ovr[i] === undefined || ovr[i] === "" ? (Number(plan.mult) || 20) : Number(ovr[i]));
  const rows = (plan.rows || []).map((r) => {
    const res = Array.from({ length: count }, (_, i) => Number(r.res[i]) || 0);
    const effort = res.reduce((s, x, i) => s + x * multFor(i), 0);
    const resTotal = res.reduce((s, x) => s + x, 0);
    const est = r.est === null || r.est === undefined || r.est === "" ? null : Number(r.est);
    return { id: r.id, effort, resTotal, est, variance: est === null ? null : Math.round((effort - est) * 10) / 10 };
  });
  const totalRes = Array.from({ length: count }, (_, i) => (plan.rows || []).reduce((s, r) => s + (Number(r.res[i]) || 0), 0));
  const projEffort = totalRes.map((x, i) => x * multFor(i));
  return {
    rows, totalRes, projEffort, multFor,
    grandRes: totalRes.reduce((s, x) => s + x, 0),
    grandEffort: projEffort.reduce((s, x) => s + x, 0),
    grandEst: rows.reduce((s, r) => s + (r.est || 0), 0),
  };
}

// map master roles -> app roles
function appRoleOf(masterRole) {
  if (masterRole === "Project Manager") return "Project Manager";
  if (masterRole === "Lead Developer") return "Lead";
  return "Developer";
}

// ============================================================
// STATIC CONFIG
// ============================================================
const ROLES = ["Developer", "Lead", "Project Manager", "Admin", "Viewer"];
const TC_STATUSES = ["Proactive", "Chased", "Beyond Monday", "N/A", "Not Updated", "Partial Updated"];
const TC_COLORS = {
  Proactive: "bg-emerald-100 text-emerald-800",
  Chased: "bg-amber-100 text-amber-800",
  "Beyond Monday": "bg-orange-100 text-orange-800",
  "Not Updated": "bg-red-100 text-red-800",
  "Partial Updated": "bg-yellow-100 text-yellow-800",
  "N/A": "bg-slate-100 text-slate-500",
  "": "bg-white text-slate-300",
};
const LEAVE_COLORS = {
  Vacation: "bg-sky-100 text-sky-800",
  Sick: "bg-rose-100 text-rose-800",
  Unpaid: "bg-slate-200 text-slate-700",
  "Half Day": "bg-violet-100 text-violet-800",
  "Comp-Off": "bg-teal-100 text-teal-800",
};
const STREAM_COLORS = {
  Batches: "bg-sky-100 text-sky-800", Bugs: "bg-red-100 text-red-800",
  "Code Optimisations": "bg-amber-100 text-amber-800", "Code Quality": "bg-lime-100 text-lime-800",
  "Database Maintainence": "bg-teal-100 text-teal-800", "Database Objects": "bg-cyan-100 text-cyan-800",
  Leads: "bg-indigo-100 text-indigo-800", "Miscellaneous Activities": "bg-slate-200 text-slate-700",
  "New Integrations": "bg-fuchsia-100 text-fuchsia-800", PM: "bg-purple-100 text-purple-800",
  "Post Production Support": "bg-orange-100 text-orange-800", Refactoring: "bg-emerald-100 text-emerald-800",
  Retrofitting: "bg-rose-100 text-rose-800", RIAM: "bg-violet-100 text-violet-800",
};
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MODULES_V2 = []; // all v2 modules shipped — Program Health was the last

// ============================================================
// SMALL UI ATOMS
// ============================================================
function Pill({ children, tone = "" }) {
  return <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + tone}>{children}</span>;
}
function Card({ title, right, children, className = "" }) {
  return (
    <div className={"rounded-xl border border-slate-200 bg-white shadow-sm " + className}>
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm" style={{ borderTop: "3px solid #00ED64" }}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
function usePaged(rows, defaultSize = 25) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(defaultSize);
  const p = pageSlice(rows, page, size);
  const pager = p.total > Math.min(10, size) ? (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 no-print">
      <span className="flex items-center gap-2">
        Rows per page
        <select className="rounded-lg border border-slate-200 px-2 py-1 text-sm" value={size}
          onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-slate-400">{p.from}–{p.to} of {p.total}</span>
      </span>
      <span className="flex items-center gap-1">
        <button disabled={p.cur <= 1} onClick={() => setPage(p.cur - 1)}
          className={"rounded-lg border border-slate-200 px-2.5 py-1 " + (p.cur <= 1 ? "cursor-not-allowed text-slate-300" : "hover:bg-slate-50")}>‹ Prev</button>
        <span className="px-2 text-slate-500">Page {p.cur} / {p.pages}</span>
        <button disabled={p.cur >= p.pages} onClick={() => setPage(p.cur + 1)}
          className={"rounded-lg border border-slate-200 px-2.5 py-1 " + (p.cur >= p.pages ? "cursor-not-allowed text-slate-300" : "hover:bg-slate-50")}>Next ›</button>
      </span>
    </div>
  ) : null;
  return { rows: p.slice, pager };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "mdb-input w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";
function Btn({ children, onClick, kind = "primary", disabled, small }) {
  const base = small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const styles = {
    primary: "mdb-btn-primary text-white",
    ghost: "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={base + " rounded-lg font-medium transition " + styles[kind]}>
      {children}
    </button>
  );
}
function Notice({ tone, children }) {
  const t = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <div className={"rounded-lg border px-3 py-2 text-sm " + t}>{children}</div>;
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  // ---- normalize seed into stateful stores ----
  const [employees, setEmployees] = useState(() =>
    SEED.E.map(([name, role, company, start, term], i) => ({ id: "e" + i, name, role, company, start, term }))
  );
  const [leaves, setLeaves] = useState(() =>
    SEED.L.map(([name, start, end, type], i) => ({ id: "l" + i, name, start, end, type }))
  );
  const [comps, setComps] = useState(() =>
    SEED.C.map(([name, date, days, reason], i) => ({ id: "c" + i, name, date, days, reason }))
  );
  const [tcRows, setTcRows] = useState(() =>
    SEED.T.map(([name, release, remarks, weeks], i) => ({ id: "t" + i, name, release, remarks, weeks: weeks.map((w) => [...w]) }))
  );
  const [leaveTypes, setLeaveTypes] = useState([
    { name: "Vacation", value: 1 },
    { name: "Sick", value: 1 },
    { name: "Unpaid", value: 1 },
    { name: "Half Day", value: 0.5 },
    { name: "Comp-Off", value: 1 },
  ]);
  const [weekendDays, setWeekendDays] = useState([0, 6]); // Sun, Sat
  const [holidays, setHolidays] = useState(SEED.H);
  const [tcWeeks, setTcWeeks] = useState(SEED.W);
  const [projects, setProjects] = useState([{ id: "p0", name: "OPUSM", phases: ["R1", "R2"], trackJira: true, streams: [...new Set([...STREAMS, "PM", "Refactoring"])], description: "", linkLabel: "", linkUrl: "" }]);
  const [assignments, setAssignments] = useState(() => {
    const relOf = Object.fromEntries(SEED.E.map((e) => [e[0], e[5] || null]));
    return (SEED.A || []).map(([name, stream, from, to], i) => ({ id: "a" + i, name, projectId: "p0", phase: relOf[name] || null, stream, from, to: to || null }));
  });
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  const [user, setUser] = useState(null); // {role, name}
  const NAV_DEEPLINK = ["dash", "myleave", "calendar", "allrecords", "compoff", "reports", "timecard", "tcsummary", "alloc", "projects", "plans", "programhealth", "perf", "runway", "employees", "settings", "admin"];
  const [nav, setNav] = useState(() => {
    const h = typeof window !== "undefined" && window.location.hash ? window.location.hash.slice(1) : "";
    return NAV_DEEPLINK.includes(h) ? h : "dash";
  });
  const [idc, setIdc] = useState(1000);
  const nextId = (p) => { setIdc(idc + 1); return p + (idc + 1); };

  const empByName = useMemo(() => Object.fromEntries(employees.map((e) => [e.name, e])), [employees]);
  // per timecard row, per week: does JIRA count toward the score? (driven by the project's trackJira setting)
  const jiraFlags = useMemo(() => {
    const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
    const out = {};
    tcRows.forEach((r) => {
      out[r.id] = tcWeeks.map((w) => {
        const acts = activeAssignmentsOn(assignments, r.name, w);
        if (!acts.length) return true; // unassigned: default to tracking both
        return acts.some((a) => { const p = projById[a.projectId]; return !p || p.trackJira !== false; });
      });
    });
    return out;
  }, [tcRows, tcWeeks, assignments, projects]);
  const [scores, setScores] = useState(() => (SEED.P || []).map(([name, week, m], i) => ({ id: "s" + i, name, week, m: [...m] })));
  const [perfCfg, setPerfCfg] = useState({ weights: [25, 20, 10, 25, 10, 10], green: 3.5, amber: 2.5, partnerOnly: true });
  const [perms, setPerms] = useState(defaultPerms);
  const [extLinks, setExtLinks] = useState([]); // admin-managed external app links shown in the sidebar
  const [plans, setPlans] = useState([]); // team plans: project+phase month-window resource planning
  const [empFields, setEmpFields] = useState([]); // admin-defined custom fields on the employee master: [{id, label}]
  const [raid, setRaid] = useState([]); // per-project RAID log entries
  const [milestones, setMilestones] = useState([]); // per-project milestones
  const [weeklyHealth, setWeeklyHealth] = useState([]); // program health: weekly hours planned/burnt + RAG per project
  const [pipeline, setPipeline] = useState([]); // program health: pre-project opportunities
  const todayISO = toISO(new Date());

  if (!user) {
    return (
      <Login
        employees={employees}
        onEnter={(role, name) => { setUser({ role, name }); setNav("dash"); }}
      />
    );
  }

  const isDev = user.role === "Developer";
  const can = (cap) => canDo(perms, user.role, cap);
  const isLead = user.role === "Lead";
  const isPM = user.role === "Project Manager";
  const isAdmin = user.role === "Admin";
  const canManage = isLead || isPM || isAdmin; // comp-off, timecard edit, insights
  const canConfigure = isPM || isAdmin; // settings, employee master

  const NAV_ITEMS = [
    { id: "dash", label: "Dashboard", section: "Overview", icon: LayoutDashboard, show: true },
    { id: "myleave", label: "My Leave", section: "Leave", icon: Plane, show: true },
    { id: "calendar", label: "Team Calendar", section: "Leave", icon: CalendarDays, show: true },
    { id: "allrecords", label: "Leave Records", section: "Leave", icon: ListChecks, show: can("leave.records") },
    { id: "reports", label: "Leave Reports", section: "Leave", icon: BarChart3, show: can("leave.reports") },
    { id: "compoff", label: "Comp-Off Log", section: "Leave", icon: Clock, show: can("leave.compoff") },
    { id: "timecard", label: isDev ? "My Timecard" : "Timecard Grid", section: "Delivery", icon: Table, show: true },
    { id: "tcsummary", label: "Timecard Insights", section: "Delivery", icon: TrendingUp, show: can("timecard.insights") },
    { id: "alloc", label: "Allocations", section: "Delivery", icon: GitBranch, show: can("alloc.view") },
    { id: "projects", label: "Projects", section: "Delivery", icon: FolderKanban, show: can("projects.view") },
    { id: "plans", label: "Team Plans", section: "Delivery", icon: ClipboardList, show: can("plans.view") },
    { id: "programhealth", label: "Program Health", section: "Delivery", icon: Activity, show: can("ph.view") },
    { id: "perf", label: "Performance", section: "Delivery", icon: Gauge, show: can("perf.view") },
    { id: "runway", label: "Remaining Runway", section: "Delivery", icon: Hourglass, show: can("runway.view") },
    { id: "employees", label: "Employees", section: "Organisation", icon: Users, show: can("employees.view") },
    { id: "settings", label: "Leave Settings", section: "Organisation", icon: SettingsIcon, show: can("settings.edit") },
    { id: "admin", label: "Administration", section: "Organisation", icon: Shield, show: isAdmin },
  ];

  const ctx = {
    user, employees, empByName, leaves, comps, tcRows, tcWeeks, leaveTypes, weekendDays, holidays, holidaySet,
    setTcWeeks, assignments, setAssignments, projects, setProjects, jiraFlags,
    scores, setScores, perfCfg, setPerfCfg, can, perms, setPerms, extLinks, setExtLinks, plans, setPlans, empFields, setEmpFields, raid, setRaid, milestones, setMilestones, weeklyHealth, setWeeklyHealth, pipeline, setPipeline,
    todayISO, canManage, canConfigure, isDev, isAdmin,
    setLeaves, setComps, setTcRows, setEmployees, setLeaveTypes, setWeekendDays, setHolidays, nextId, setNav,
  };

  return (
    <div className="min-h-screen text-slate-800" style={{ fontFamily: BRAND_FONT, backgroundColor: "#F9FBFA" }}>
      <style>{BRAND_CSS}</style>
      {/* top bar */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#001E2B" }}><Leaf size={22} /></div>
            <div>
              <div className="text-sm font-semibold leading-tight text-slate-900" style={{ fontFamily: BRAND_FONT }}>DeliveryHub</div>
              <div className="text-xs leading-tight text-slate-500">AMP · APAC — unified tracker console</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
              <span className={"h-2 w-2 rounded-full " + (isAdmin ? "bg-purple-500" : isPM ? "mdb-dot-spring" : isLead ? "bg-sky-500" : user.role === "Viewer" ? "bg-teal-400" : "bg-slate-400")} />
              <span className="text-xs font-medium text-slate-700">{user.name}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{user.role}</span>
            </div>
            <Btn kind="ghost" small onClick={() => setUser(null)}>Switch user</Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1720px] gap-6 px-4 py-6">
        {/* sidebar */}
        <aside className="w-56 shrink-0 no-print lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {["Overview", "Leave", "Delivery", "Organisation"].map((sec) => {
              const items = NAV_ITEMS.filter((n) => n.show && n.section === sec);
              if (!items.length) return null;
              return (
                <div key={sec} className="mb-2">
                  <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{sec}</div>
                  {items.map((n) => {
                    const Icon = n.icon;
                    return (
                      <button key={n.id} onClick={() => setNav(n.id)}
                        className={"flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition " +
                          (nav === n.id ? "mdb-nav-active" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                        {Icon && <Icon size={16} className={nav === n.id ? "" : "text-slate-400"} />}
                        {n.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {extLinks.length > 0 && (
              <div className="border-t border-slate-100 pt-2">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Links</div>
                {extLinks.map((l) => (
                  <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" title={l.description || l.url}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                    <ExternalLink size={15} className="text-slate-400" />{l.label}
                  </a>
                ))}
              </div>
            )}
            {MODULES_V2.some((m) => m.roles.includes(user.role)) && (
              <div className="border-t border-slate-100 pt-2">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Coming next</div>
                {MODULES_V2.map((m) => {
                  const visible = m.roles.includes(user.role);
                  if (!visible) return null;
                  return (
                    <button key={m.id} onClick={() => setNav("v2:" + m.id)}
                      className={"flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition " + (nav === "v2:" + m.id ? "bg-slate-50 text-slate-700" : "text-slate-400 hover:bg-slate-50")}>
                      <Lock size={14} />{m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* main */}
        <main className="min-w-0 flex-1">
          {nav === "dash" && <Dashboard {...ctx} />}
          {nav === "myleave" && <MyLeave {...ctx} />}
          {nav === "calendar" && <TeamCalendar {...ctx} />}
          {nav === "allrecords" && can("leave.records") && <AllLeaveRecords {...ctx} />}
          {nav === "reports" && can("leave.reports") && <LeaveReports {...ctx} />}
          {nav === "compoff" && can("leave.compoff") && <CompOffLog {...ctx} />}
          {nav === "timecard" && <TimecardGrid {...ctx} />}
          {nav === "tcsummary" && can("timecard.insights") && <TimecardInsights {...ctx} />}
          {nav === "alloc" && can("alloc.view") && <AllocationsView {...ctx} />}
          {nav === "projects" && can("projects.view") && <ProjectsView {...ctx} />}
          {nav === "plans" && can("plans.view") && <TeamPlansView {...ctx} />}
          {nav === "programhealth" && can("ph.view") && <ProgramHealthView {...ctx} />}
          {nav === "perf" && can("perf.view") && <PerformanceView {...ctx} />}
          {nav === "runway" && can("runway.view") && <RunwayView {...ctx} />}
          {nav === "employees" && can("employees.view") && <EmployeesView {...ctx} />}
          {nav === "settings" && can("settings.edit") && <SettingsView {...ctx} />}
          {nav === "admin" && isAdmin && <AdminPanel {...ctx} />}
          {nav.startsWith("v2:") && <ComingSoon id={nav.slice(3)} role={user.role} />}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function Login({ employees, onEnter }) {
  const [role, setRole] = useState("Developer");
  const [name, setName] = useState("");
  const today = toISO(new Date());
  const pool = useMemo(() => {
    const active = employees.filter((e) => isActiveDuring(e, today, today));
    if (role === "Admin") return active.filter((e) => e.role === "Project Manager");
    if (role === "Viewer") return active; // any active person can be simulated as a read-only viewer
    return active.filter((e) => appRoleForEmp(e) === role);
  }, [role, employees, today]);
  const effective = name && pool.some((p) => p.name === name) ? name : pool[0] ? pool[0].name : "";
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ fontFamily: BRAND_FONT, backgroundColor: "#001E2B" }}>
      <style>{BRAND_CSS}</style>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "#001E2B" }}><Leaf size={28} /></div>
          <h1 className="text-2xl font-semibold text-white" style={{ fontFamily: BRAND_FONT }}>DeliveryHub</h1>
          <p className="mt-1 text-sm" style={{ color: "#E3FCF7", opacity: 0.75 }}>Leave · Timecard · one role-scoped console for AMP APAC</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-slate-600">Sign in as</div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button key={r} onClick={() => { setRole(r); setName(""); }}
                  className={"rounded-lg border px-3 py-2 text-sm font-medium transition " + (role === r ? "mdb-role-active" : "border-slate-300 text-slate-600 hover:border-slate-400")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Field label={role === "Admin" ? "Acting as (PMs hold admin rights)" : "Your name"}>
            <select className={inputCls} value={effective} onChange={(e) => setName(e.target.value)}>
              {pool.map((p) => <option key={p.id} value={p.name}>{p.name} — {p.company}</option>)}
            </select>
          </Field>
          <div className="mt-5">
            <button onClick={() => effective && onEnter(role, effective)}
              className="mdb-btn-primary w-full rounded-lg py-2.5 text-sm font-semibold text-white transition">
              Enter console
            </button>
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
            Prototype: roles are simulated. Developer sees own leave & timecard only; Lead (including designated Stream Leads) manages comp-off, timecards, allocations and performance; PM manages projects, settings and the employee master; Admin controls everything.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard(ctx) {
  const { user, leaves, tcRows, tcWeeks, holidays, todayISO, leaveTypes, weekendDays, holidaySet, comps, isDev, setNav, empByName } = ctx;
  const canManage = ctx.can("timecard.insights");
  const onToday = onLeaveOn(todayISO, leaves);
  // this week range (Mon..Sun containing today)
  const t = parseISO(todayISO);
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7));
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const wkStart = toISO(monday), wkEnd = toISO(sunday);
  const thisWeek = leaves.filter((l) => l.start <= wkEnd && wkStart <= l.end);
  const upcomingHol = holidays.filter((h) => h >= todayISO).slice(0, 3);
  let lastWeekIdx = tcWeeks.length - 1;
  while (lastWeekIdx > 0 && weekComplianceFlex(tcRows, lastWeekIdx, ctx.jiraFlags) === null) lastWeekIdx--;
  const compliance = weekComplianceFlex(tcRows, lastWeekIdx, ctx.jiraFlags);
  const mine = balancesFor(user.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
  const myNext = leaves.filter((l) => l.name === user.name && l.end >= todayISO).sort((a, b) => a.start.localeCompare(b.start))[0];
  const myTc = tcRows.find((r) => r.name === user.name);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, {user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-slate-500">{fmt(todayISO)} · viewing as {user.role}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="On leave today" value={onToday.length} sub={onToday.slice(0, 2).map((l) => l.name.split(" ")[0]).join(", ") || "Full house"} />
        <Stat label="Leaves this week" value={thisWeek.length} sub={fmtShort(wkStart) + " – " + fmtShort(wkEnd)} />
        <Stat label={canManage ? "Timecard proactive (last wk)" : "My comp-off balance"} value={canManage ? (compliance === null ? "—" : compliance + "%") : mine.compOffBalance} sub={canManage ? "week ending " + fmtShort(tcWeeks[lastWeekIdx]) : mine.compOffEarned + " earned · " + mine.compOffUsed + " used"} />
        <Stat label="Next holiday" value={upcomingHol[0] ? fmtShort(upcomingHol[0]) : "—"} sub={upcomingHol.slice(1).map(fmtShort).join(" · ")} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Away this week" right={<Btn kind="ghost" small onClick={() => setNav("calendar")}>Open calendar</Btn>}>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-slate-500">No one is on leave this week.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {thisWeek.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{l.name}</div>
                    <div className="text-xs text-slate-500">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""} · {empByName[l.name] ? empByName[l.name].company : ""}</div>
                  </div>
                  <Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill>
                </li>
              ))}
              {thisWeek.length > 8 && <li className="py-2 text-xs text-slate-400">+ {thisWeek.length - 8} more on the calendar</li>}
            </ul>
          )}
        </Card>
        <Card title="My snapshot" right={<Btn kind="ghost" small onClick={() => setNav("myleave")}>My leave</Btn>}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Vacation taken</div>
              <div className="text-lg font-semibold">{mine.byType["Vacation"] || 0} days</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Sick taken</div>
              <div className="text-lg font-semibold">{mine.byType["Sick"] || 0} days</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">My stream</div>
              <div className="mt-1">
                {(() => {
                  const act = activeAssignmentsOn(ctx.assignments, user.name, todayISO);
                  if (act.length === 0) return <span className="text-sm text-slate-400">Unallocated</span>;
                  const pname = (a) => { const p = ctx.projects.find((x) => x.id === a.projectId); return (p ? p.name : "?") + (a.phase ? " · " + a.phase : ""); };
                  return <span className="inline-flex flex-wrap gap-1">{act.slice(0, 2).map((a) => <Pill key={a.id} tone={STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600"}>{pname(a)}{a.stream ? " · " + a.stream : ""}</Pill>)}</span>;
                })()}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Next leave</div>
              <div className="text-sm font-medium">{myNext ? fmtShort(myNext.start) + " · " + myNext.type : "None planned"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">My last timecard (SF / JIRA)</div>
              <div className="mt-1 flex gap-1">
                {myTc ? (
                  <>
                    <Pill tone={TC_COLORS[(myTc.weeks[lastWeekIdx] || ["", ""])[0] || ""]}>{(myTc.weeks[lastWeekIdx] || ["", ""])[0] || "—"}</Pill>
                    <Pill tone={TC_COLORS[(myTc.weeks[lastWeekIdx] || ["", ""])[1] || ""]}>{(myTc.weeks[lastWeekIdx] || ["", ""])[1] || "—"}</Pill>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Not on the timecard grid</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// MY LEAVE (all roles) — submit + own history + balances
// ============================================================
function MyLeave(ctx) {
  const { user, leaves, comps, leaveTypes, weekendDays, holidaySet, setLeaves, nextId, canManage, employees, todayISO } = ctx;
  const [who, setWho] = useState(user.name);
  const [start, setStart] = useState(todayISO);
  const [end, setEnd] = useState(todayISO);
  const [type, setType] = useState(leaveTypes[0].name);
  const [msg, setMsg] = useState(null);
  const [pendingOverlap, setPendingOverlap] = useState(null);

  const canForAnyone = ctx.can("leave.forAnyone");
  const canOwn = ctx.can("leave.own");
  const target = canForAnyone ? who : user.name;
  const bal = balancesFor(target, leaves, comps, leaveTypes, weekendDays, holidaySet);
  const my = leaves.filter((l) => l.name === target).sort((a, b) => b.start.localeCompare(a.start));

  function submit(force) {
    setMsg(null);
    if (!start || !end) return setMsg({ tone: "error", text: "Both start and end dates are required." });
    if (end < start) return setMsg({ tone: "error", text: "End date can't be before the start date." });
    const entry = { name: target, start, end, type };
    if (isDuplicate(leaves, entry)) return setMsg({ tone: "error", text: "This exact leave already exists — duplicate entries are blocked (mirrors the DUPLICATE? check in the old tracker)." });
    const days = leaveDays(start, end, type, leaveTypes, weekendDays, holidaySet);
    if (days === 0) return setMsg({ tone: "error", text: "That range has no working days (weekend / holiday only), so no leave is needed." });
    if (type === "Comp-Off" && bal.compOffBalance < days) {
      return setMsg({ tone: "error", text: `Comp-off balance is ${bal.compOffBalance} day(s) — not enough for a ${days}-day comp-off leave. Ask your lead to log earned comp-off first.` });
    }
    const overlaps = findOverlaps(leaves, entry);
    if (overlaps.length && !force) {
      setPendingOverlap(overlaps);
      return;
    }
    setLeaves([...leaves, { id: nextId("l"), ...entry }]);
    setPendingOverlap(null);
    setMsg({ tone: "ok", text: `Leave recorded — ${days} working day(s) of ${type} for ${target}.` });
  }
  function remove(id) {
    setLeaves(leaves.filter((l) => l.id !== id));
    setMsg({ tone: "ok", text: "Leave entry deleted." });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>My Leave</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {leaveTypes.map((t) => (
          <Stat key={t.name} label={t.name + " taken"} value={bal.byType[t.name] || 0} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Comp-off earned" value={bal.compOffEarned} />
        <Stat label="Comp-off used" value={bal.compOffUsed} />
        <Stat label="Comp-off balance" value={bal.compOffBalance} sub={bal.compOffBalance < 0 ? "Negative — review entries" : ""} />
      </div>

      {!canOwn && !canForAnyone && <Notice tone="warn">Read-only access — your role can browse leave data but can't submit entries. An Admin can grant this in the permission matrix.</Notice>}
      {(canOwn || canForAnyone) && <Card title="Request leave">
        <div className="grid gap-3 sm:grid-cols-4">
          {canForAnyone && (
            <Field label="Employee (PM / Lead can file for anyone)">
              <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
                {employees.map((e) => <option key={e.id} value={e.name}>{e.name}{e.term && e.term <= todayISO ? " (ended)" : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Start date"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Leave type">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {leaveTypes.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.value} day)</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Btn onClick={() => submit(false)}>Submit leave</Btn>
          <span className="text-xs text-slate-500">
            Counts {leaveDays(start, end, type, leaveTypes, weekendDays, holidaySet)} working day(s) — weekends & holidays excluded.
          </span>
        </div>
        {pendingOverlap && (
          <div className="mt-3">
            <Notice tone="warn">
              Overlaps {pendingOverlap.length} existing entr{pendingOverlap.length > 1 ? "ies" : "y"}: {pendingOverlap.map((o) => fmtShort(o.start) + "–" + fmtShort(o.end) + " " + o.type).join(", ")}.
              <span className="ml-2 inline-flex gap-2">
                <Btn small kind="ghost" onClick={() => submit(true)}>Save anyway</Btn>
                <Btn small kind="ghost" onClick={() => setPendingOverlap(null)}>Cancel</Btn>
              </span>
            </Notice>
          </div>
        )}
        {msg && <div className="mt-3"><Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice></div>}
      </Card>}

      <Card title={"Leave history — " + target}>
        {my.length === 0 ? (
          <p className="text-sm text-slate-500">No leave recorded yet. Your first request will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Working days</th><th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {my.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4">{fmt(l.start)}{l.start !== l.end ? " → " + fmt(l.end) : ""}</td>
                    <td className="py-2 pr-4"><Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill></td>
                    <td className="py-2 pr-4">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)}</td>
                    <td className="py-2 text-right">
                      {(canForAnyone || (canOwn && l.name === user.name)) && <Btn small kind="danger" onClick={() => remove(l.id)}>Delete</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// TEAM CALENDAR (view for everyone)
// ============================================================
function TeamCalendar(ctx) {
  const { leaves, holidays, holidaySet, weekendDays, empByName } = ctx;
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()]); // [year, 0-based month]
  const [year, month] = ym;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay(); // cells before day 1 (weeks start Sunday like the source tracker)
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthName = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthLeaves = useMemo(() => {
    const startISO = toISO(new Date(year, month, 1));
    const endISO = toISO(new Date(year, month, daysInMonth));
    return leaves.filter((l) => l.start <= endISO && startISO <= l.end);
  }, [leaves, year, month, daysInMonth]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Team Calendar</h2>
        <div className="flex items-center gap-2">
          <Btn kind="ghost" small onClick={() => setYm(month === 0 ? [year - 1, 11] : [year, month - 1])}>←</Btn>
          <div className="w-44 text-center text-sm font-semibold">{monthName}</div>
          <Btn kind="ghost" small onClick={() => setYm(month === 11 ? [year + 1, 0] : [year, month + 1])}>→</Btn>
        </div>
      </div>
      <Card>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-slate-50 px-2 py-1.5 text-center font-semibold text-slate-500">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={"x" + i} className="bg-white" style={{ minHeight: 84 }} />;
            const iso = toISO(new Date(year, month, d));
            const dow = new Date(year, month, d).getDay();
            const wk = weekendDays.includes(dow);
            const hol = holidaySet.has(iso);
            const on = onLeaveOn(iso, monthLeaves);
            return (
              <div key={iso} style={{ minHeight: 84 }} className={"p-1.5 " + (hol ? "bg-emerald-50" : wk ? "bg-slate-50" : "bg-white")}>
                <div className="flex items-center justify-between">
                  <span className={"text-xs font-semibold " + (hol ? "text-emerald-700" : wk ? "text-slate-400" : "text-slate-600")}>{d}</span>
                  {hol && <span className="text-xs font-medium uppercase text-emerald-600">Holiday</span>}
                </div>
                <div className="mt-1 space-y-0.5">
                  {on.slice(0, 3).map((l) => (
                    <div key={l.id + iso} className={"truncate rounded px-1 py-0.5 text-xs font-medium " + (LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600")} title={l.name + " · " + l.type + (empByName[l.name] ? " · " + empByName[l.name].company : "")}>
                      {l.name.split(" ")[0]} {l.name.split(" ")[1] ? l.name.split(" ")[1][0] + "." : ""}
                    </div>
                  ))}
                  {on.length > 3 && <div className="text-xs text-slate-400">+{on.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium">Legend:</span>
          {Object.entries(LEAVE_COLORS).map(([k, v]) => <Pill key={k} tone={v}>{k}</Pill>)}
          <Pill tone="bg-emerald-50 text-emerald-700 border border-emerald-200">Holiday</Pill>
        </div>
      </Card>
      <Card title={"Everyone away in " + monthName + " (" + monthLeaves.length + " entries)"}>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {monthLeaves.sort((a, b) => a.start.localeCompare(b.start)).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
              <span className="truncate font-medium text-slate-700">{l.name}</span>
              <span className="ml-2 shrink-0 text-slate-500">{fmtShort(l.start)}{l.start !== l.end ? "–" + fmtShort(l.end) : ""}</span>
            </div>
          ))}
          {monthLeaves.length === 0 && <p className="text-sm text-slate-500">No leave this month.</p>}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// ALL LEAVE RECORDS (Lead / PM / Admin)
// ============================================================
function AllLeaveRecords(ctx) {
  const { leaves, leaveTypes, weekendDays, holidaySet, setLeaves, empByName } = ctx;
  const [q, setQ] = useState("");
  const [ft, setFt] = useState("All");
  const rows = leaves
    .filter((l) => (ft === "All" || l.type === ft) && l.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.start.localeCompare(a.start));
  const { rows: pageRows, pager: leavePager } = usePaged(rows, 25);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Records — all people</h2>
      <div className="flex flex-wrap gap-3">
        <input className={inputCls + " max-w-xs"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} style={{ maxWidth: 160 }} value={ft} onChange={(e) => setFt(e.target.value)}>
          <option>All</option>
          {leaveTypes.map((t) => <option key={t.name}>{t.name}</option>)}
        </select>
        <span className="self-center text-xs text-slate-500">{rows.length} entries</span>
      </div>
      <Card>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4">Type</th><th className="py-2 pr-4">Days</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-4 font-medium text-slate-800">{l.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{empByName[l.name] ? empByName[l.name].company : "—"}</td>
                  <td className="py-1.5 pr-4">{fmtShort(l.start)}{l.start !== l.end ? " – " + fmtShort(l.end) : ""}</td>
                  <td className="py-1.5 pr-4"><Pill tone={LEAVE_COLORS[l.type] || "bg-slate-100 text-slate-600"}>{l.type}</Pill></td>
                  <td className="py-1.5 pr-4">{leaveDays(l.start, l.end, l.type, leaveTypes, weekendDays, holidaySet)}</td>
                  <td className="py-1.5 text-right"><Btn small kind="danger" onClick={() => setLeaves(leaves.filter((x) => x.id !== l.id))}>Delete</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leavePager}
      </Card>
    </div>
  );
}

// ============================================================
// LEAVE REPORTS (Lead / PM / Admin) — totals by role / company
// ============================================================
function LeaveReports(ctx) {
  const { leaves, employees, empByName, leaveTypes, weekendDays, holidaySet, todayISO, assignments, projects } = ctx;
  const [period, setPeriod] = useState("all");
  const [groupBy, setGroupBy] = useState("role");
  const r1 = (x) => Math.round(x * 10) / 10;

  const months = useMemo(() => {
    const set = new Set();
    leaves.forEach((l) => { set.add(l.start.slice(0, 7)); set.add(l.end.slice(0, 7)); });
    return [...set].sort();
  }, [leaves]);

  let rangeStart = "0000-01-01", rangeEnd = "9999-12-31";
  if (period !== "all") {
    rangeStart = period + "-01";
    const [y, m] = period.split("-").map(Number);
    rangeEnd = toISO(new Date(y, m, 0)); // last day of month
  }
  const monthLabel = (ym) => parseISO(ym + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const keyOf = (name) => {
    const e = empByName[name];
    if (!e) return "Unknown";
    return groupBy === "role" ? e.role : e.company;
  };
  const groups = {};
  leaves.forEach((l) => {
    const d = leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
    if (d === 0) return;
    const k = keyOf(l.name);
    if (!groups[k]) groups[k] = { total: 0, byType: {}, people: new Set() };
    groups[k].total += d;
    groups[k].byType[l.type] = (groups[k].byType[l.type] || 0) + d;
    groups[k].people.add(l.name);
  });
  // headcount respects end dates: active in the selected month, or active today for "All months"
  const activeStart = period === "all" ? todayISO : rangeStart;
  const activeEnd = period === "all" ? todayISO : rangeEnd;
  const activeEmployees = employees.filter((e) => isActiveDuring(e, activeStart, activeEnd));
  const headcount = {};
  activeEmployees.forEach((e) => {
    const k = groupBy === "role" ? e.role : e.company;
    headcount[k] = (headcount[k] || 0) + 1;
  });
  const rows = Object.entries(groups)
    .map(([k, g]) => ({ key: k, total: g.total, byType: g.byType, onLeave: g.people.size, hc: headcount[k] || 0 }))
    .sort((a, b) => b.total - a.total);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const peopleOnLeave = new Set();
  leaves.forEach((l) => { if (leaveDaysInRange(l, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet) > 0) peopleOnLeave.add(l.name); });
  const maxTotal = rows.length ? rows[0].total : 1;
  const periodText = period === "all" ? "all recorded months" : monthLabel(period);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Reports</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[["role", "By role"], ["company", "By company"]].map(([v, lab]) => (
              <button key={v} onClick={() => setGroupBy(v)}
                className={"px-4 py-2 text-sm font-medium transition " + (groupBy === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                {lab}
              </button>
            ))}
          </div>
          <select className={inputCls + " w-48"} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">All months</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Btn kind="ghost" small onClick={() => {
            const pr = leaveByProjectRole(leaves, empByName, assignments, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
            const pName2 = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : pid; };
            downloadXlsx("leave-report-" + (period === "all" ? "all" : period) + ".xlsx", [
              [(groupBy === "role" ? "By role" : "By company"), [[groupBy === "role" ? "Role" : "Company", "Active headcount", "On leave", ...leaveTypes.map((t) => t.name), "Total days", "Avg per person"], ...rows.map((r) => [r.key, r.hc, r.onLeave, ...leaveTypes.map((t) => r1(r.byType[t.name] || 0)), r1(r.total), r1(r.total / r.onLeave)])]],
              ["Project x Role", [["Project", "PM", "LD", "SD", "Dev", "Total"], ...Object.entries(pr.byProject).map(([pid, v]) => [pName2(pid), r1(v.PM), r1(v.LD), r1(v.SD), r1(v.Dev), r1(v.total)]), ["Unassigned", r1(pr.unassigned.PM), r1(pr.unassigned.LD), r1(pr.unassigned.SD), r1(pr.unassigned.Dev), r1(pr.unassigned.total)], ["All", r1(pr.totals.PM), r1(pr.totals.LD), r1(pr.totals.SD), r1(pr.totals.Dev), r1(pr.totals.total)]]],
            ]);
          }}>⬇ Excel</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total leave days" value={r1(grand)} sub={periodText} />
        <Stat label="People on leave" value={peopleOnLeave.size} sub={"of " + activeEmployees.length + (period === "all" ? " active today" : " active in " + monthLabel(period))} />
        <Stat label="Avg per person on leave" value={peopleOnLeave.size ? r1(grand / peopleOnLeave.size) : 0} sub="working days" />
        <Stat label={"Highest " + (groupBy === "role" ? "role" : "company")} value={rows.length ? rows[0].key : "—"} sub={rows.length ? r1(rows[0].total) + " days" : "no leave in this period"} />
      </div>
      <Card title={"Leave days " + (groupBy === "role" ? "by role" : "by company") + " — " + periodText}>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No leave recorded in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">{groupBy === "role" ? "Role" : "Company"}</th>
                  <th className="py-2 pr-4 text-right">Active headcount</th>
                  <th className="py-2 pr-4 text-right">On leave</th>
                  {leaveTypes.map((t) => <th key={t.name} className="py-2 pr-4 text-right">{t.name}</th>)}
                  <th className="py-2 pr-4 text-right">Total days</th>
                  <th className="py-2 pr-4 text-right">Avg / person on leave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.key}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">{r.hc}</td>
                    <td className="py-2 pr-4 text-right">{r.onLeave}</td>
                    {leaveTypes.map((t) => (
                      <td key={t.name} className="py-2 pr-4 text-right">{r.byType[t.name] ? r1(r.byType[t.name]) : <span className="text-slate-300">—</span>}</td>
                    ))}
                    <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(r.total)}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{r1(r.total / r.onLeave)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td className="py-2 pr-4 font-semibold text-slate-900">All</td>
                  <td className="py-2 pr-4 text-right text-slate-500">{activeEmployees.length}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{peopleOnLeave.size}</td>
                  {leaveTypes.map((t) => (
                    <td key={t.name} className="py-2 pr-4 text-right font-semibold">{r1(rows.reduce((s, r) => s + (r.byType[t.name] || 0), 0)) || <span className="font-normal text-slate-300">—</span>}</td>
                  ))}
                  <td className="py-2 pr-4 text-right font-semibold text-slate-900">{r1(grand)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{peopleOnLeave.size ? r1(grand / peopleOnLeave.size) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {(() => {
        const pr = leaveByProjectRole(leaves, empByName, assignments, rangeStart, rangeEnd, leaveTypes, weekendDays, holidaySet);
        const pName2 = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : pid; };
        const prRows = Object.entries(pr.byProject).map(([pid, v]) => ({ label: pName2(pid), ...v }));
        if (pr.unassigned.total) prRows.push({ label: "Unassigned", ...pr.unassigned });
        return (
          <Card title={"Leave days by project × role — " + periodText}>
            {prRows.length === 0 ? <p className="text-sm text-slate-500">No leave attributable in this period.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Project</th>
                      {["PM", "LD", "SD", "Dev"].map((r) => <th key={r} className="py-2 pr-4 text-right">{r}</th>)}
                      <th className="py-2 pr-4 text-right">Total days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prRows.sort((a, b) => b.total - a.total).map((r) => (
                      <tr key={r.label} className={r.label === "Unassigned" ? "text-slate-500" : ""}>
                        <td className="py-2 pr-4 font-medium">{r.label}</td>
                        {["PM", "LD", "SD", "Dev"].map((k) => <td key={k} className="py-2 pr-4 text-right">{r[k] ? r1(r[k]) : <span className="text-slate-300">—</span>}</td>)}
                        <td className="py-2 pr-4 text-right font-semibold">{r1(r.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold">
                      <td className="py-2 pr-4">All</td>
                      {["PM", "LD", "SD", "Dev"].map((k) => <td key={k} className="py-2 pr-4 text-right">{r1(pr.totals[k])}</td>)}
                      <td className="py-2 pr-4 text-right">{r1(pr.totals.total)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">A person's leave is attributed to the project(s) they're assigned to during the period — split evenly when on multiple projects concurrently. Roles: PM / Lead Developer / Senior Developer / Developer.</p>
              </div>
            )}
          </Card>
        );
      })()}
      {rows.length > 0 && (
        <Card title={"Share of leave " + (groupBy === "role" ? "by role" : "by company")}>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <div className="w-36 shrink-0 truncate font-medium text-slate-700">{r.key}</div>
                <div className="h-5 flex-1 rounded bg-slate-100">
                  <div className="mdb-bar flex h-5 items-center rounded px-2 text-xs font-medium text-white" style={{ width: Math.max(6, Math.round((r.total / maxTotal) * 100)) + "%" }}>
                    {r1(r.total)}
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right text-xs text-slate-500">{grand ? Math.round((r.total / grand) * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// COMP-OFF LOG (Lead / PM / Admin)
// ============================================================
function CompOffLog(ctx) {
  const { comps, setComps, employees, weekendDays, holidaySet, nextId, leaves, leaveTypes, todayISO } = ctx;
  const [who, setWho] = useState(employees[0] ? employees[0].name : "");
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState(null);
  function add() {
    setMsg(null);
    if (!who || !date) return setMsg({ tone: "error", text: "Employee and date worked are required." });
    if (!compOffDateValid(date, weekendDays, holidaySet)) {
      return setMsg({ tone: "error", text: fmt(date) + " is a normal working day. Comp-off can only be earned for work on a weekend or a listed holiday (same rule as the old tracker)." });
    }
    if (comps.some((c) => c.name === who && c.date === date)) {
      return setMsg({ tone: "error", text: "A comp-off entry for " + who + " on " + fmt(date) + " already exists." });
    }
    setComps([...comps, { id: nextId("c"), name: who, date, days: Number(days), reason }]);
    setReason("");
    setMsg({ tone: "ok", text: "Comp-off logged: " + who + " earns " + days + " day(s) for " + fmt(date) + "." });
  }
  const sorted = [...comps].sort((a, b) => b.date.localeCompare(a.date));
  const { rows: coPage, pager: coPager } = usePaged(sorted, 25);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Comp-Off Earned</h2>
      <Card title="Log approved comp-off (weekend / holiday work only)">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Employee">
            <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
              {employees.map((e) => <option key={e.id} value={e.name}>{e.name}{e.term && e.term <= todayISO ? " (ended)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Date worked"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Earned days">
            <select className={inputCls} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="1">1 — full day</option>
              <option value="0.5">0.5 — half day</option>
            </select>
          </Field>
          <Field label="Reason (short)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Prod cutover support" /></Field>
        </div>
        <div className="mt-3"><Btn onClick={add}>Log comp-off</Btn></div>
        {msg && <div className="mt-3"><Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice></div>}
      </Card>
      <Card title={"Comp-off ledger (" + comps.length + " entries)"}>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Date worked</th><th className="py-2 pr-4">Earned</th><th className="py-2 pr-4">Balance now</th><th className="py-2 pr-4">Reason</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coPage.map((c) => {
                const b = balancesFor(c.name, leaves, comps, leaveTypes, weekendDays, holidaySet);
                return (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-4 font-medium text-slate-800">{c.name}</td>
                    <td className="py-1.5 pr-4">{fmt(c.date)}</td>
                    <td className="py-1.5 pr-4">{c.days}</td>
                    <td className="py-1.5 pr-4"><Pill tone={b.compOffBalance >= 0 ? "bg-teal-100 text-teal-800" : "bg-red-100 text-red-800"}>{b.compOffBalance}</Pill></td>
                    <td className="py-1.5 pr-4 text-slate-500">{c.reason || "—"}</td>
                    <td className="py-1.5 text-right"><Btn small kind="danger" onClick={() => setComps(comps.filter((x) => x.id !== c.id))}>Delete</Btn></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {coPager}
      </Card>
    </div>
  );
}

// ============================================================
// TIMECARD GRID
// ============================================================
function TimecardGrid(ctx) {
  const { tcRows, setTcRows, tcWeeks, setTcWeeks, employees, setEmployees, empByName, user, isDev, todayISO, jiraFlags } = ctx;
  const canManage = ctx.can("timecard.editAll"); // edit cells · import · add weeks
  const [q, setQ] = useState("");
  const [co, setCo] = useState("All");
  const [pending, setPending] = useState(null); // parsed upload awaiting confirmation
  const [impMsg, setImpMsg] = useState(null);
  const WIN = 8; // weeks visible at once
  const [winStart, setWinStart] = useState(Math.max(0, tcWeeks.length - WIN));
  const maxStart = Math.max(0, tcWeeks.length - WIN);
  const start = Math.min(Math.max(0, winStart), maxStart);
  const visWeeks = tcWeeks.map((w, i) => ({ w, i })).slice(start, start + WIN);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    setImpMsg(null);
    setPending(null);
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const wsName =
        wb.SheetNames.find((n) => n.toLowerCase().includes("proactive")) ||
        wb.SheetNames.find((n) => n.toLowerCase().includes("timecard")) ||
        wb.SheetNames[0];
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: null });
      const parsed = parseTimecardGrid(grid);
      if (parsed.weeks.length === 0 || parsed.rows.length === 0) {
        return setImpMsg({ tone: "error", text: "Couldn't read the sheet \"" + wsName + "\" — expected week dates in row 1 from column F (SF/JIRA pairs) and resources from row 3, like the Resource Allocation template." });
      }
      const knownRoles = ["Developer", "Senior Developer", "Lead Developer", "Project Manager"];
      const knownCos = ["MDB", "WeKan", "Ciklum", "Globant"];
      const newPeople = parsed.rows
        .filter((r) => !empByName[r.name])
        .map((r) => ({
          name: r.name,
          role: knownRoles.find((k) => k.toLowerCase() === r.role.toLowerCase()) || "Developer",
          company: knownCos.find((k) => k.toLowerCase() === r.company.toLowerCase()) || (r.company || "MDB"),
          start: todayISO,
          term: null,
        }));
      setPending({ ...parsed, sheet: wsName, fileName: file.name, newPeople });
    } catch (err) {
      setImpMsg({ tone: "error", text: "That file couldn't be opened as an Excel workbook (" + (err && err.message ? err.message : "unknown error") + ")." });
    }
  }
  function applyImport() {
    if (!pending) return;
    const stamp = Date.now();
    if (pending.newPeople.length) {
      setEmployees([...employees, ...pending.newPeople.map((p, i) => ({ ...p, id: "eimp" + stamp + "_" + i }))]);
    }
    setTcWeeks(pending.weeks);
    setTcRows(pending.rows.map((r, i) => ({ id: "timp" + stamp + "_" + i, name: r.name, release: r.release, remarks: r.remarks, weeks: r.weeks })));
    setWinStart(Number.MAX_SAFE_INTEGER); // clamps to the latest window
    setImpMsg({
      tone: "ok",
      text: "Imported " + pending.rows.length + " resources × " + pending.weeks.length + " weeks from " + pending.fileName +
        (pending.newPeople.length ? ". Added " + pending.newPeople.length + " new " + (pending.newPeople.length > 1 ? "people" : "person") + " to the employee master." : "."),
    });
    setPending(null);
  }
  const nextWeekISO = (() => {
    if (!tcWeeks.length) { const t = parseISO(todayISO); return toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((7 - t.getDay()) % 7 || 7))); }
    const d = parseISO(tcWeeks[tcWeeks.length - 1]);
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  })();
  function addWeek() {
    setTcWeeks([...tcWeeks, nextWeekISO]);
    setTcRows(tcRows.map((r) => ({ ...r, weeks: [...r.weeks, ["", ""]] })));
    setWinStart(Number.MAX_SAFE_INTEGER);
    setImpMsg({ tone: "ok", text: "Week ending " + fmt(nextWeekISO) + " added — every resource gets blank SF/JIRA cells to fill through the week." });
  }
  const companies = ["All", ...Array.from(new Set(tcRows.map((r) => SEEDCO(r.name)))).sort()];
  function SEEDCO(name) {
    const e = ctx.empByName[name];
    return e ? e.company : "—";
  }
  const rows = isDev
    ? tcRows.filter((r) => r.name === user.name)
    : tcRows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || SEEDCO(r.name) === co));
  const { rows: gridRows, pager: gridPager } = usePaged(rows, 25);
  function setCell(rowId, weekIdx, slot, value) {
    setTcRows(tcRows.map((r) => {
      if (r.id !== rowId) return r;
      const weeks = r.weeks.map((w, i) => (i === weekIdx ? [slot === 0 ? value : w[0], slot === 1 ? value : w[1]] : w));
      return { ...r, weeks };
    }));
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{isDev ? "My Timecard Proactiveness" : "Timecard Proactiveness Grid"}</h2>
        {!isDev && (
          <div className="flex flex-wrap gap-2">
            <input className={inputCls + " w-48"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={inputCls + " w-32"} value={co} onChange={(e) => setCo(e.target.value)}>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </select>
            {canManage && <Btn kind="ghost" small onClick={addWeek}>+ Add week ({fmtShort(nextWeekISO)})</Btn>}
            {canManage && (
              <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Import weekly file
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>
            )}
          </div>
        )}
      </div>
      {impMsg && <Notice tone={impMsg.tone === "error" ? "error" : "ok"}>{impMsg.text}</Notice>}
      {pending && (
        <Card title={"Review import — " + pending.fileName}>
          <ul className="space-y-1 text-sm text-slate-700">
            <li><span className="font-medium">{pending.weeks.length} weeks</span> found on sheet "{pending.sheet}" — {fmtShort(pending.weeks[0])} to {fmtShort(pending.weeks[pending.weeks.length - 1])}.</li>
            <li><span className="font-medium">{pending.rows.length} resources</span>, {pending.rows.length - pending.newPeople.length} already in the employee master.</li>
            {pending.newPeople.length > 0 && (
              <li className="text-amber-700">{pending.newPeople.length} new: {pending.newPeople.map((p) => p.name).join(", ")} — will be added to the employee master on import.</li>
            )}
            {pending.duplicates > 0 && <li className="text-amber-700">{pending.duplicates} duplicate name row(s) in the file — first occurrence kept.</li>}
            {pending.unknownStatuses > 0 && <li className="text-amber-700">{pending.unknownStatuses} cell(s) had unrecognised status values and will import as blank. Valid: {TC_STATUSES.join(", ")}.</li>}
            <li className="text-slate-500">Importing replaces the whole grid with the file contents — the file is the source of truth, so week-on-week you just re-upload the same workbook.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Btn onClick={applyImport}>Import & replace grid</Btn>
            <Btn kind="ghost" onClick={() => setPending(null)}>Cancel</Btn>
          </div>
        </Card>
      )}
      {isDev && rows.length === 0 && (
        <Notice tone="warn">You're not on the timecard grid yet — your lead or PM will add you when SF / JIRA tracking starts for you.</Notice>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Btn kind="ghost" small onClick={() => setWinStart(0)} disabled={start === 0}>« First</Btn>
          <Btn kind="ghost" small onClick={() => setWinStart(start - WIN)} disabled={start === 0}>← Earlier</Btn>
          <select className={inputCls + " w-48"} value={start} onChange={(e) => setWinStart(Math.min(Number(e.target.value), maxStart))}>
            {tcWeeks.map((w, i) => <option key={w} value={i}>week ending {fmtShort(w)}</option>)}
          </select>
          <Btn kind="ghost" small onClick={() => setWinStart(start + WIN)} disabled={start >= maxStart}>Later →</Btn>
          <Btn kind="ghost" small onClick={() => setWinStart(maxStart)} disabled={start >= maxStart}>Latest »</Btn>
          <span className="text-xs text-slate-500">showing weeks {start + 1}–{start + visWeeks.length} of {tcWeeks.length}</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-2 text-left font-semibold text-slate-600">Resource</th>
                {visWeeks.map(({ w }) => (
                  <th key={w} colSpan={2} className="border-b border-l border-slate-200 bg-white px-1 py-1 text-center font-semibold text-slate-600">{fmtShort(w)}</th>
                ))}
                <th className="border-b border-l border-slate-200 bg-white px-2 py-2 font-semibold text-slate-600">Proactive %</th>
              </tr>
              <tr>
                <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-1 text-left font-normal text-slate-400">week ending →</th>
                {visWeeks.map(({ w }) => [
                  <th key={w + "sf"} className="border-b border-l border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-500">SF</th>,
                  <th key={w + "j"} className="border-b border-slate-200 bg-slate-50 px-1 py-1 font-medium text-slate-500">JIRA</th>,
                ])}
                <th className="border-b border-l border-slate-200 bg-white" />
              </tr>
            </thead>
            <tbody>
              {gridRows.map((r) => {
                const st = tcStatsFlex(r.weeks, jiraFlags[r.id]);
                return (
                  <tr key={r.id} className="group">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-white px-2 py-1 font-medium text-slate-800 group-hover:bg-slate-50">
                      {r.name}
                      <span className="ml-1 text-xs text-slate-400">{r.release}</span>
                      {r.remarks && <span className="ml-1 cursor-help text-amber-500" title={r.remarks}>ⓘ</span>}
                    </td>
                    {visWeeks.map(({ i: wi }) => {
                      const w = r.weeks[wi] || ["", ""];
                      const jiraOn = !jiraFlags[r.id] || jiraFlags[r.id][wi] !== false;
                      return [0, 1].map((slot) => slot === 1 && !jiraOn ? (
                        <td key={r.id + wi + slot} className="border-b border-slate-100 p-0.5">
                          <div style={{ width: 86 }} title="JIRA not tracked for this resource's project this week — excluded from the proactiveness score" className="rounded bg-slate-50 px-1 py-1 text-center text-xs font-medium text-slate-300">n/t</div>
                        </td>
                      ) : (
                        <td key={r.id + wi + slot} className={"border-b border-slate-100 p-0.5 " + (slot === 0 ? "border-l" : "")}>
                          {canManage ? (
                            <select
                              value={w[slot] || ""}
                              onChange={(e) => setCell(r.id, wi, slot, e.target.value)}
                              style={{ width: 86 }}
                              className={"cursor-pointer appearance-none rounded px-1 py-1 text-center text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400 " + TC_COLORS[w[slot] || ""]}
                            >
                              <option value="">—</option>
                              {TC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div style={{ width: 86 }} className={"rounded px-1 py-1 text-center text-xs font-medium " + TC_COLORS[w[slot] || ""]}>{w[slot] || "—"}</div>
                          )}
                        </td>
                      ));
                    })}
                    <td className="border-b border-l border-slate-100 px-2 text-center">
                      {st.pct === null ? <span className="text-slate-300">—</span> : (
                        <Pill tone={st.pct >= 80 ? "bg-emerald-100 text-emerald-800" : st.pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{st.pct}%</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {gridPager}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {TC_STATUSES.map((s) => <Pill key={s} tone={TC_COLORS[s]}>{s}</Pill>)}
          {canManage && <span className="self-center text-slate-400">Click any cell to update. "n/t" = JIRA not tracked for that project (configured per project in the Projects menu) — excluded from the score.</span>}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// TIMECARD INSIGHTS (Lead / PM / Admin)
// ============================================================
function TimecardInsights(ctx) {
  const { tcRows, tcWeeks, empByName, jiraFlags } = ctx;
  const scored = tcRows
    .map((r) => ({ ...r, st: tcStatsFlex(r.weeks, jiraFlags[r.id]) }))
    .filter((r) => r.st.pct !== null);
  const worst = [...scored].sort((a, b) => a.st.pct - b.st.pct).slice(0, 10);
  const best = [...scored].sort((a, b) => b.st.pct - a.st.pct).slice(0, 5);
  const weekly = tcWeeks.map((w, i) => ({ w, pct: weekComplianceFlex(tcRows, i, jiraFlags) }));
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.st.pct, 0) / scored.length) : 0;
  const totals = { Proactive: 0, Chased: 0, "Beyond Monday": 0, "Not Updated": 0, "Partial Updated": 0 };
  scored.forEach((r) => Object.keys(totals).forEach((k) => (totals[k] += r.st[k] || 0)));
  function exportExcel() {
    downloadXlsx("timecard-insights.xlsx", [
      ["Per resource", [["Resource", "Company", "Release", "Proactive %", "Proactive", "Chased", "Beyond Monday", "Not Updated", "Partial Updated"], ...scored.map((r) => [r.name, empByName[r.name] ? empByName[r.name].company : "", r.release, r.st.pct, r.st.Proactive, r.st.Chased, r.st["Beyond Monday"], r.st["Not Updated"], r.st["Partial Updated"]])]],
      ["Weekly compliance", [["Week ending", "Proactive %"], ...weekly.map((w) => [w.w, w.pct === null ? "" : w.pct])]],
    ]);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Timecard Insights</h2>
        <Btn kind="ghost" small onClick={exportExcel}>⬇ Excel</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Avg proactiveness" value={avg + "%"} sub={scored.length + " tracked resources"} />
        <Stat label="Chased entries" value={totals["Chased"]} sub="times someone had to follow up" />
        <Stat label="Beyond Monday" value={totals["Beyond Monday"]} sub="late past the deadline" />
        <Stat label="Not updated" value={totals["Not Updated"]} sub="missing timecards" />
      </div>
      <Card title="Week-by-week compliance (SF + JIRA, Proactive share)">
        <div className="flex items-end gap-2">
          {weekly.map(({ w, pct }) => (
            <div key={w} className="flex-1 text-center">
              <div className="mx-auto flex h-32 w-full items-end rounded bg-slate-100" style={{ maxWidth: 48 }}>
                <div
                  className={"w-full rounded " + ((pct || 0) >= 80 ? "bg-emerald-500" : (pct || 0) >= 60 ? "bg-amber-400" : "bg-red-400")}
                  style={{ height: (pct || 0) + "%" }}
                  title={pct + "%"}
                />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-600">{pct === null ? "—" : pct + "%"}</div>
              <div className="text-xs text-slate-400">{fmtShort(w)}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Needs chasing — lowest proactiveness">
          <ul className="divide-y divide-slate-100">
            {worst.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{empByName[r.name] ? empByName[r.name].company : ""} · {r.release}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{r.st["Not Updated"]} missed · {r.st["Chased"]} chased</span>
                  <Pill tone={r.st.pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{r.st.pct}%</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Most reliable — top proactiveness">
          <ul className="divide-y divide-slate-100">
            {best.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{empByName[r.name] ? empByName[r.name].company : ""} · {r.release}</span>
                </div>
                <Pill tone="bg-emerald-100 text-emerald-800">{r.st.pct}%</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// weighted burn engine shared by the Allocations and Projects views
function computeBurn(assignments, employees, empByName, year, weekendDays, holidaySet) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const byPerson = {};
    assignments.forEach((a) => {
      const emp = empByName[a.name];
      const clipped = {
        ...a,
        from: emp && emp.start && emp.start > a.from ? emp.start : a.from,
        to: emp && emp.term && (!a.to || emp.term < a.to) ? emp.term : a.to,
      };
      if (clipped.to && clipped.to < clipped.from) return;
      (byPerson[a.name] = byPerson[a.name] || []).push(clipped);
    });
    const rows = [];
    const agg = {}; // projectId -> { total, byPhase, byStream, people:Set }  (Projects tab)
    const perProj = {}; // projectId -> { phases:Set, monthly: {m: {phase: days}} }  (Burn tab)
    months.forEach((m) => {
      const [ms, me] = monthRange(year, m);
      const wdim = workingDaysBetween(ms, me, weekendDays, holidaySet);
      const byProj = {};
      let effort = 0;
      Object.values(byPerson).forEach((pas) => {
        const split = effortSplitInMonth(pas, year, m, weekendDays, holidaySet);
        pas.forEach((a) => {
          const d = split[a.id] || 0;
          if (!d) return;
          effort += d;
          byProj[a.projectId] = (byProj[a.projectId] || 0) + d;
          const g = (agg[a.projectId] = agg[a.projectId] || { total: 0, byPhase: {}, byStream: {}, people: new Set() });
          g.total += d;
          const ph = a.phase || "—";
          g.byPhase[ph] = (g.byPhase[ph] || 0) + d;
          const sKey = a.stream || "—";
          g.byStream[sKey] = (g.byStream[sKey] || 0) + d;
          g.people.add(a.name);
          const P = (perProj[a.projectId] = perProj[a.projectId] || { phases: new Set(), monthly: {} });
          P.phases.add(ph);
          (P.monthly[m] = P.monthly[m] || {})[ph] = (P.monthly[m][ph] || 0) + d;
        });
      });
      const active = employees.filter((e) => isActiveDuring(e, ms, me));
      const unalloc = active.filter((e) => !assignments.some((a) => a.name === e.name && a.from <= me && ms <= (a.to || OPEN_END))).length;
      rows.push({ m, wdim, effort, byProj, fte: wdim ? effort / wdim : 0, active: active.length, unalloc });
    });
    return { rows, agg, perProj };
}

// ============================================================
// ALLOCATIONS (Lead/PM/Admin assign · PM/Admin manage projects)
// ============================================================
function AllocationsView(ctx) {
  const { assignments, setAssignments, projects, employees, empByName, weekendDays, holidaySet, nextId, todayISO } = ctx;
  const canEdit = ctx.can("alloc.edit");
  const [tab, setTab] = useState("plan"); // plan | projects | burn
  const [year, setYear] = useState(2026);
  const [q, setQ] = useState("");
  const [fproj, setFproj] = useState("All");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({ projectId: "", phase: "", stream: "", from: todayISO, to: "", ongoing: true, weeklyHours: 40 });
  const [asOf, setAsOf] = useState(todayISO);
  const [gby, setGby] = useState("project"); // project | phase | stream | flat
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const mLabel = (m) => parseISO(year + "-" + String(m).padStart(2, "0") + "-01").toLocaleDateString("en-IN", { month: "short" });
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const pName = (a) => (projById[a.projectId] ? projById[a.projectId].name : "?");
  const label = (a) => pName(a) + (a.phase ? " · " + a.phase : "") + " · " + a.stream;

  const roster = employees
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // assignments in a month for one person (optionally filtered by project)
  function inMonth(name, m) {
    const [ms, me] = monthRange(year, m);
    return assignments.filter((a) => a.name === name && (fproj === "All" || a.projectId === fproj) && a.from <= me && ms <= (a.to || OPEN_END));
  }

  function addAssignment() {
    setMsg(null);
    if (!sel) return;
    const proj = projById[form.projectId];
    if (!proj) return setMsg({ tone: "error", text: "Pick a project." });
    if (!selProj) return setMsg({ tone: "error", text: "Create a project first — assignments need one." });
    const pstreams = selProj.streams || [];
    if (form.stream && !pstreams.includes(form.stream)) return setMsg({ tone: "error", text: "Stream " + form.stream + " isn't defined on this project — manage streams in the Projects menu." });
    const entry = { name: sel, projectId: effPid, phase: form.phase || null, stream: form.stream || null, from: form.from, to: form.ongoing ? null : form.to || null, weeklyHours: Number(form.weeklyHours) || 40 };
    if (!entry.from) return setMsg({ tone: "error", text: "Start date is required." });
    if (!form.ongoing && (!form.to || form.to < form.from)) return setMsg({ tone: "error", text: "End date must be on or after the start date (or mark it ongoing)." });
    const emp = empByName[sel];
    if (emp && emp.term && entry.from > emp.term) return setMsg({ tone: "error", text: sel + "'s end date is " + fmt(emp.term) + " — can't start an assignment after it." });
    const clash = aOverlaps(assignments, entry);
    if (clash.length) return setMsg({ tone: "error", text: "Overlaps on " + proj.name + ": " + clash.map((c) => c.stream + " (" + fmtShort(c.from) + " – " + (c.to ? fmtShort(c.to) : "ongoing") + ")").join(", ") + ". One assignment per project at a time — end that one first." });
    const cross = crossProjectConcurrent(assignments, entry);
    setAssignments([...assignments, { id: nextId("a"), ...entry }]);
    setMsg({ tone: "ok", text: "Assigned " + sel + " to " + proj.name + (entry.phase ? " · " + entry.phase : "") + " · " + entry.stream + " from " + fmt(entry.from) + (entry.to ? " to " + fmt(entry.to) : " (ongoing)") + "." + (cross.length ? " Runs alongside " + cross.map(pName).join(", ") + " — FTE splits evenly across concurrent projects." : "") });
  }
  function endToday(a) {
    setAssignments(assignments.map((x) => (x.id === a.id ? { ...x, to: todayISO } : x)));
    setMsg({ tone: "ok", text: a.name + "'s " + label(a) + " assignment ended today." });
  }

  const burn = useMemo(() => computeBurn(assignments, employees, empByName, year, weekendDays, holidaySet),
    [assignments, employees, empByName, year, weekendDays, holidaySet]);

  const selAssignments = sel ? assignments.filter((a) => a.name === sel).sort((a, b) => a.from.localeCompare(b.from)) : [];
  // self-healing project id: live databases use ObjectIds, so never trust a stale/hardcoded value
  const effPid = projById[form.projectId] ? form.projectId : (projects[0] ? projects[0].id : "");
  const selProj = projById[effPid];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Allocations</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {[["plan", "Plan"], ["roster", "Roster"], ["burn", "Projected Burn"]].map(([v, lab]) => (
              <button key={v} onClick={() => setTab(v)}
                className={"px-4 py-2 text-sm font-medium transition " + (tab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                {lab}
              </button>
            ))}
          </div>
          <select className={inputCls + " w-28"} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab === "plan" && (
            <>
              <input className={inputCls + " w-40"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className={inputCls + " w-36"} value={fproj} onChange={(e) => setFproj(e.target.value)}>
                <option value="All">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}

      {tab === "plan" && sel && (
        <Card title={"Assignments — " + sel} right={<Btn kind="ghost" small onClick={() => { setSel(null); setMsg(null); }}>Close</Btn>}>
          {selAssignments.length === 0 ? (
            <p className="mb-3 text-sm text-slate-500">No assignments yet — {sel.split(" ")[0]} is unallocated.</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100">
              {selAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-700">{pName(a)}</span>
                    {a.phase && <span className="ml-1 text-slate-500">· {a.phase}</span>}
                    <Pill tone={"ml-2 " + (STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600")}>{a.stream || "—"}</Pill>
                    {a.weeklyHours && Number(a.weeklyHours) !== 40 ? <Pill tone="ml-1 bg-orange-100 text-orange-800">{a.weeklyHours} h/wk</Pill> : null}
                    <span className="ml-2 text-slate-600">{fmt(a.from)} → {a.to ? fmt(a.to) : "ongoing"}</span>
                  </span>
                  <span className="flex gap-2">
                    {canEdit && (!a.to || a.to > todayISO) && <Btn small kind="ghost" onClick={() => endToday(a)}>End today</Btn>}
                    {canEdit && <Btn small kind="danger" onClick={() => setAssignments(assignments.filter((x) => x.id !== a.id))}>Delete</Btn>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-5">
            <Field label="Project">
              <select className={inputCls} value={effPid} onChange={(e) => setForm({ ...form, projectId: e.target.value, phase: "", stream: "" })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                <option value="">—</option>
                {(selProj ? selProj.phases : []).map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Stream">
              <select className={inputCls} value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}>
                <option value="">— no stream —</option>
                {((selProj || {}).streams || []).map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="From"><input type="date" className={inputCls} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
            <Field label="Hours/week (runway)"><input type="number" min="1" max="80" className={inputCls} value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} /></Field>
            <div>
              <Field label="To (blank = ongoing)"><input type="date" className={inputCls} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value, ongoing: !e.target.value })} /></Field>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-3 w-3 accent-emerald-700" checked={form.ongoing} onChange={(e) => setForm({ ...form, ongoing: e.target.checked, to: e.target.checked ? "" : form.to })} />
                Ongoing (no end date)
              </label>
            </div>
          </div>
          {canEdit ? <div className="mt-3"><Btn onClick={addAssignment}>Add assignment</Btn></div> : <Notice tone="warn">View only — your role can't edit assignments.</Notice>}
        </Card>
      )}

      {tab === "plan" && (
        <Card>
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-separate text-xs" style={{ borderSpacing: 0 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-slate-200 bg-white px-2 py-2 text-left font-semibold text-slate-600">Resource</th>
                  {months.map((m) => <th key={m} className="border-b border-l border-slate-200 bg-white px-1 py-2 text-center font-semibold text-slate-600" style={{ minWidth: 92 }}>{mLabel(m)} {String(year).slice(2)}</th>)}
                </tr>
              </thead>
              <tbody>
                {roster.map((e) => (
                  <tr key={e.id} className="group cursor-pointer" onClick={() => { setSel(e.name); setMsg(null); }}>
                    <td className={"sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 px-2 py-1 font-medium group-hover:bg-slate-50 " + (sel === e.name ? "bg-emerald-50 text-emerald-900" : "bg-white text-slate-800")}>
                      {e.name}
                    </td>
                    {months.map((m) => {
                      const as2 = inMonth(e.name, m);
                      return (
                        <td key={m} className="border-b border-l border-slate-100 p-0.5 text-center">
                          {as2.length === 0 ? <span className="text-slate-200">·</span> : (
                            <span className="inline-flex flex-wrap justify-center gap-0.5">
                              {as2.slice(0, 2).map((a) => (
                                <span key={a.id} title={label(a) + " · " + fmt(a.from) + " → " + (a.to ? fmt(a.to) : "ongoing")}
                                  className={"rounded px-1 py-0.5 text-xs font-medium " + (STREAM_COLORS[a.stream] || "bg-slate-100 text-slate-600")}>
                                  {a.stream ? (a.stream.length > 12 ? a.stream.slice(0, 11) + "…" : a.stream) : "—"}
                                </span>
                              ))}
                              {as2.length > 2 && <span className="text-xs text-slate-400">+{as2.length - 2}</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Click a resource to manage assignments. Hover a chip for project · phase · dates. Concurrent projects split FTE evenly.</p>
        </Card>
      )}

      {tab === "roster" && (() => {
        const active = employees.filter((e) => isActiveDuring(e, asOf, asOf)).sort((a, b) => a.name.localeCompare(b.name));
        const rows = []; // one row per (person, assignment) active on asOf
        const unalloc = [];
        active.forEach((e) => {
          const acts = activeAssignmentsOn(assignments, e.name, asOf);
          if (acts.length === 0) unalloc.push(e);
          else acts.forEach((a) => rows.push({ e, a }));
        });
        const allocated = active.length - unalloc.length;
        const multi = active.filter((e) => activeAssignmentsOn(assignments, e.name, asOf).length > 1).length;
        const keyOf = (r) => gby === "project" ? pName(r.a) : gby === "phase" ? (r.a.phase || "No phase") : (r.a.stream || "No stream");
        const groups = {};
        if (gby !== "flat") rows.forEach((r) => { (groups[keyOf(r)] = groups[keyOf(r)] || []).push(r); });
        const fteOf = (r) => 1 / activeAssignmentsOn(assignments, r.e.name, asOf).length;
        const rowCells = (r) => (
          <tr key={r.e.id + r.a.id}>
            <td className="py-1.5 pr-4 font-medium text-slate-800">{r.e.name}</td>
            <td className="py-1.5 pr-4 text-slate-500">{r.e.company}</td>
            <td className="py-1.5 pr-4">{pName(r.a)}</td>
            <td className="py-1.5 pr-4 text-slate-600">{r.a.phase || "—"}</td>
            <td className="py-1.5 pr-4"><Pill tone={STREAM_COLORS[r.a.stream] || "bg-slate-100 text-slate-600"}>{r.a.stream || "—"}</Pill></td>
            <td className="py-1.5 pr-4 text-slate-500">{fmtShort(r.a.from)} → {r.a.to ? fmtShort(r.a.to) : "ongoing"}</td>
            <td className="py-1.5 pr-4 text-right">{Math.round(fteOf(r) * 100) / 100}</td>
          </tr>
        );
        const header = (
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Resource</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Project</th>
            <th className="py-2 pr-4">Phase</th><th className="py-2 pr-4">Stream</th><th className="py-2 pr-4">Dates</th><th className="py-2 pr-4 text-right">FTE</th>
          </tr>
        );
        return (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {[["project", "By project"], ["phase", "By phase"], ["stream", "By stream"], ["flat", "Flat list"]].map(([v, lab]) => (
                  <button key={v} onClick={() => setGby(v)}
                    className={"px-3 py-2 text-sm font-medium transition " + (gby === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                    {lab}
                  </button>
                ))}
              </div>
              <input type="date" className={inputCls + " w-40"} value={asOf} onChange={(e) => setAsOf(e.target.value || todayISO)} />
              <span className="text-xs text-slate-500">snapshot as of {fmt(asOf)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Active people" value={active.length} sub={"as of " + fmtShort(asOf)} />
              <Stat label="Allocated" value={allocated} sub={active.length ? Math.round((allocated / active.length) * 100) + "% of active" : ""} />
              <Stat label="Unallocated" value={unalloc.length} sub={unalloc.length ? "need a plan" : "fully planned"} />
              <Stat label="On multiple projects" value={multi} sub="FTE split evenly" />
            </div>
            {gby === "flat" ? (
              <Card title={"All allocations — " + rows.length + " assignment(s) active"}>
                {rows.length === 0 ? <p className="text-sm text-slate-500">Nobody is allocated on this date.</p> : (
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">{header}</thead>
                      <tbody className="divide-y divide-slate-100">{rows.map(rowCells)}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : (
              Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([k, list]) => (
                <Card key={k} title={k + " — " + list.length + " assignment(s), " + new Set(list.map((r) => r.e.name)).size + " people, " + Math.round(list.reduce((s, r) => s + fteOf(r), 0) * 10) / 10 + " FTE"}>
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">{header}</thead>
                      <tbody className="divide-y divide-slate-100">{list.sort((a, b) => a.e.name.localeCompare(b.e.name)).map(rowCells)}</tbody>
                    </table>
                  </div>
                </Card>
              ))
            )}
            {gby !== "flat" && Object.keys(groups).length === 0 && (
              <Card><p className="text-sm text-slate-500">Nobody is allocated on this date — everyone appears below.</p></Card>
            )}
            {unalloc.length > 0 && (
              <Card title={"Unallocated — " + unalloc.length + " active people with no assignment on " + fmtShort(asOf)}>
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {unalloc.map((e) => (
                    <button key={e.id} onClick={() => { setTab("plan"); setSel(e.name); setMsg(null); }}
                      className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-1.5 text-left text-xs transition hover:bg-amber-100">
                      <span className="truncate font-medium text-slate-700">{e.name}</span>
                      <span className="ml-2 shrink-0 text-slate-500">{e.company} · assign →</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </>
        );
      })()}

      {tab === "burn" && (
        <>
          <Notice tone="ok">Capacity is in person-months, working-day exact — weekends and the {holidaySet.size} configured holidays are excluded automatically. Example: an allocation 16 Jul → 16 Aug 2026 contributes 12/23 of July + 10/20 of August ≈ 1.0 capacity.</Notice>
          <Card title={"Overall burn " + year + " — day-weighted across concurrent projects, clipped to employment windows"}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Month</th><th className="py-2 pr-4 text-right">Working days</th>
                    <th className="py-2 pr-4 text-right">Effort (days)</th><th className="py-2 pr-4 text-right">Capacity (FTE)</th>
                    <th className="py-2 pr-4 text-right">Active</th><th className="py-2 pr-4 text-right">Unallocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {burn.rows.map((r) => (
                    <tr key={r.m} className={r.effort ? "" : "text-slate-400"}>
                      <td className="py-1.5 pr-4 font-medium">{mLabel(r.m)}</td>
                      <td className="py-1.5 pr-4 text-right">{r.wdim}</td>
                      <td className="py-1.5 pr-4 text-right font-semibold">{r1(r.effort)}</td>
                      <td className="py-1.5 pr-4 text-right">{Math.round(r.fte * 100) / 100}</td>
                      <td className="py-1.5 pr-4 text-right text-slate-500">{r.active}</td>
                      <td className="py-1.5 pr-4 text-right">{r.unalloc ? <Pill tone="bg-amber-100 text-amber-800">{r.unalloc}</Pill> : <span className="text-slate-300">0</span>}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 font-semibold">
                    <td className="py-2 pr-4">Total {year}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">{burn.rows.reduce((s, r) => s + r.wdim, 0)}</td>
                    <td className="py-2 pr-4 text-right">{r1(burn.rows.reduce((s, r) => s + r.effort, 0))}</td>
                    <td className="py-2 pr-4 text-right">{Math.round(burn.rows.reduce((s, r) => s + r.fte, 0) * 100) / 100} p-m</td>
                    <td /><td />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          {projects.filter((p) => burn.perProj[p.id]).map((p) => (
            <ProjectBurnCard key={p.id} project={p} perProj={burn.perProj[p.id]} rows={burn.rows} mLabel={mLabel} />
          ))}
          {Object.keys(burn.perProj).length === 0 && (
            <Card><p className="text-sm text-slate-500">No effort lands in {year} yet — add assignments on the Plan tab.</p></Card>
          )}
        </>
      )}
    </div>
  );
}

// per-project burn table: months × phases, each phase showing Capacity (person-months) + Days
function ProjectBurnCard({ project, perProj, rows, mLabel }) {
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const phases = [...perProj.phases].sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)));
  const activeMonths = rows.filter((r) => perProj.monthly[r.m]);
  const phTotals = {};
  phases.forEach((ph) => (phTotals[ph] = { d: 0, c: 0 }));
  let projDays = 0, projCap = 0;
  const body = activeMonths.map((r) => {
    const mm = perProj.monthly[r.m];
    let mDays = 0;
    const cells = [];
    phases.forEach((ph) => {
      const d = mm[ph] || 0;
      mDays += d;
      const cap = r.wdim ? d / r.wdim : 0;
      phTotals[ph].d += d;
      phTotals[ph].c += cap;
      cells.push(
        <td key={ph + "c"} className="border-l border-slate-100 py-1.5 pl-3 pr-2 text-right">{d ? r2(cap) : <span className="text-slate-300">—</span>}</td>,
        <td key={ph + "d"} className="py-1.5 pr-4 text-right text-slate-600">{d ? r1(d) : <span className="text-slate-300">—</span>}</td>
      );
    });
    const mCap = r.wdim ? mDays / r.wdim : 0;
    projDays += mDays;
    projCap += mCap;
    return (
      <tr key={r.m}>
        <td className="py-1.5 pr-4 font-medium">{mLabel(r.m)} <span className="text-xs text-slate-400">({r.wdim} wd)</span></td>
        {cells}
        <td className="border-l border-slate-200 py-1.5 pl-3 pr-2 text-right font-semibold">{r2(mCap)}</td>
        <td className="py-1.5 pr-4 text-right font-semibold">{r1(mDays)}</td>
      </tr>
    );
  });
  return (
    <Card title={"Burn by phase — " + project.name}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Month</th>
              {phases.map((ph) => <th key={ph} colSpan={2} className="border-l border-slate-100 py-2 pl-3 pr-4 text-right">{ph === "—" ? "No phase" : ph}</th>)}
              <th colSpan={2} className="border-l border-slate-200 py-2 pl-3 pr-4 text-right">Project total</th>
            </tr>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
              <th className="py-1 pr-4 font-normal">working-day exact</th>
              {phases.map((ph) => [
                <th key={ph + "c"} className="border-l border-slate-100 py-1 pl-3 pr-2 text-right font-normal">Capacity</th>,
                <th key={ph + "d"} className="py-1 pr-4 text-right font-normal">Days</th>,
              ])}
              <th className="border-l border-slate-200 py-1 pl-3 pr-2 text-right font-normal">Capacity</th>
              <th className="py-1 pr-4 text-right font-normal">Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {body}
            <tr className="border-t border-slate-200 font-semibold">
              <td className="py-2 pr-4">Total</td>
              {phases.map((ph) => [
                <td key={ph + "c"} className="border-l border-slate-100 py-2 pl-3 pr-2 text-right">{r2(phTotals[ph].c)} p-m</td>,
                <td key={ph + "d"} className="py-2 pr-4 text-right">{r1(phTotals[ph].d)}</td>,
              ])}
              <td className="border-l border-slate-200 py-2 pl-3 pr-2 text-right">{r2(projCap)} p-m</td>
              <td className="py-2 pr-4 text-right">{r1(projDays)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Capacity = effort days ÷ working days in the month (person-months, "p-m"). A full-month allocation = 1.00; partial months show as fractions.</p>
    </Card>
  );
}

// ============================================================
// PROGRAM HEALTH (portfolio · weekly health · pipeline)
// Raw facts stored; RAG, elapsed %, variances derived on render.
// ============================================================
function ProgramHealthView(ctx) {
  const { projects, setProjects, raid, milestones, weeklyHealth, setWeeklyHealth, pipeline, setPipeline, nextId, todayISO, user } = ctx;
  const canRegister = ctx.can("ph.register");
  const canWeekly = ctx.can("ph.weekly");
  const canPipeline = ctx.can("ph.pipeline");
  const marginsVisible = user.role === "Project Manager" || user.role === "Admin";
  const [tab, setTab] = useState("portfolio");
  const [msg, setMsg] = useState(null);
  const pc = (x) => (x === null || x === undefined ? "—" : Math.round(x * 100) + "%");
  const ragTone = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
  const latestWeekly = (pid) => weeklyHealth.filter((w) => w.projectId === pid).sort((a, b) => b.week.localeCompare(a.week))[0] || null;

  // ---- portfolio register ----
  const [regEdit, setRegEdit] = useState(null); // { id, totalStories, doneStories, currentMargin, keyUpdate }
  function saveRegister(p) {
    const t = regEdit.totalStories === "" ? null : Number(regEdit.totalStories);
    const dn = regEdit.doneStories === "" ? null : Number(regEdit.doneStories);
    const cm = regEdit.currentMargin === "" ? null : Number(regEdit.currentMargin);
    if (t !== null && dn !== null && dn > t) return setMsg({ tone: "error", text: "Completed stories can't exceed total." });
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, totalStories: t, doneStories: dn, currentMargin: cm, keyUpdate: regEdit.keyUpdate.trim() } : x)));
    setRegEdit(null);
    setMsg({ tone: "ok", text: p.name + " register updated." });
  }

  // ---- weekly health ----
  const satOf = (iso) => { const d = parseISO(iso); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); return toISO(d); };
  const emptyW = { projectId: "", week: satOf(todayISO), hoursPlanned: "", hoursBurnt: "", scopeChanges: false, rag: "Green", oneLiner: "" };
  const [wf, setWf] = useState(emptyW);
  const [wEditId, setWEditId] = useState(null);
  const effWPid = projects.some((p) => p.id === wf.projectId) ? wf.projectId : (projects[0] ? projects[0].id : "");
  function saveWeekly() {
    setMsg(null);
    if (!effWPid) return setMsg({ tone: "error", text: "Create a project first." });
    if (!wf.week) return setMsg({ tone: "error", text: "Week ending date is required." });
    if (wf.hoursPlanned === "" || Number(wf.hoursPlanned) < 0) return setMsg({ tone: "error", text: "Hours planned is required (0 is allowed)." });
    const dup = weeklyHealth.find((w) => w.projectId === effWPid && w.week === wf.week && w.id !== wEditId);
    if (dup) return setMsg({ tone: "error", text: "An entry for that project and week already exists — edit it instead." });
    const doc = { projectId: effWPid, week: wf.week, hoursPlanned: Number(wf.hoursPlanned) || 0, hoursBurnt: Number(wf.hoursBurnt) || 0, scopeChanges: !!wf.scopeChanges, rag: wf.rag, oneLiner: wf.oneLiner.trim() };
    if (wEditId) {
      setWeeklyHealth(weeklyHealth.map((w) => (w.id === wEditId ? { ...w, ...doc, updatedAt: todayISO } : w)));
      setWEditId(null);
    } else {
      setWeeklyHealth([...weeklyHealth, { ...doc, id: nextId("wh"), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setWf({ ...emptyW, projectId: effWPid });
    setMsg({ tone: "ok", text: "Weekly health saved." });
  }
  const [whProj, setWhProj] = useState("all");
  const whRows = weeklyHealth.filter((w) => whProj === "all" || w.projectId === whProj).sort((a, b) => b.week.localeCompare(a.week));
  const { rows: whPage, pager: whPager } = usePaged(whRows, 10);

  // ---- pipeline ----
  const emptyP = { company: "", stage: PH_STAGES[0], potentialStart: "", potentialResources: "", commentary: "", nextAction: "" };
  const [pf2, setPf2] = useState(emptyP);
  const [pEditId, setPEditId] = useState(null);
  function savePipeline() {
    setMsg(null);
    if (!pf2.company.trim()) return setMsg({ tone: "error", text: "Company / opportunity name is required." });
    const doc = { company: pf2.company.trim(), stage: pf2.stage, potentialStart: pf2.potentialStart.trim(), potentialResources: pf2.potentialResources === "" ? null : Number(pf2.potentialResources), commentary: pf2.commentary.trim(), nextAction: pf2.nextAction.trim() };
    if (pEditId) {
      setPipeline(pipeline.map((x) => (x.id === pEditId ? { ...x, ...doc, updatedAt: todayISO } : x)));
      setPEditId(null);
    } else {
      setPipeline([...pipeline, { ...doc, id: nextId("pl"), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setPf2(emptyP);
  }

  const pName = (pid) => { const p = projects.find((x) => x.id === pid); return p ? p.name : "?"; };
  const openHigh = raid.filter((x) => x.status !== "Closed" && x.impact === "H");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Program Health</h2>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {[["portfolio", "Portfolio"], ["weekly", "Weekly health"], ["pipeline", "Pipeline (" + pipeline.length + ")"]].map(([v, lab]) => (
            <button key={v} onClick={() => setTab(v)} className={"rounded-md px-3 py-1 text-sm " + (tab === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>{lab}</button>
          ))}
        </div>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}

      {tab === "portfolio" && (
        <>
        <Card title={"Active projects (" + projects.length + ") — derived live from register data, weekly entries, RAID and milestones"}
          right={<Btn kind="ghost" small onClick={() => {
            downloadXlsx("program-health-portfolio.xlsx", [["Portfolio", [
              ["Project", "PM", "Phase", "Start", "Target end", "% time elapsed", "Stories done/total", "Task completion %", "Burn vs plan %", "Schedule variance %", "High risks (open)", "Next milestone", "Latest RAG", "Key update"].concat(marginsVisible ? ["Target margin %", "Current margin %", "Margin variance %"] : []),
              ...projects.map((p) => {
                const el = phElapsedPct(p.start, p.end, todayISO);
                const sv = phScheduleVar(p.totalStories, p.doneStories, el);
                const bv = phBurnVsPlan(weeklyHealth.filter((w) => w.projectId === p.id));
                const lw = latestWeekly(p.id);
                const base = [p.name, p.pm || "", p.currentPhase || "", p.start || "", p.end || "", el === null ? "" : el, (p.doneStories ?? "") + "/" + (p.totalStories ?? ""), sv.completion ?? "", bv ?? "", sv.variance ?? "", phHighRisks(raid, p.id), (() => { const nm = milestones.filter((m) => m.projectId === p.id && m.status !== "Complete").sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1))[0]; return nm ? nm.name + (nm.planned ? " " + nm.planned : "") : ""; })(), lw ? lw.rag : "", p.keyUpdate || ""];
                return marginsVisible ? base.concat([p.targetMargin ?? "", p.currentMargin ?? "", p.targetMargin !== null && p.targetMargin !== undefined && p.currentMargin !== null && p.currentMargin !== undefined ? Math.round((p.currentMargin - p.targetMargin) * 10) / 10 : ""]) : base;
              }),
            ]]]);
          }}>⬇ Excel</Btn>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Project</th><th className="py-2 pr-3">PM</th><th className="py-2 pr-3">Phase</th>
                  <th className="py-2 pr-3 text-right">Elapsed</th><th className="py-2 pr-3 text-right">Stories</th><th className="py-2 pr-3 text-right">Done</th>
                  <th className="py-2 pr-3 text-right">Burn vs plan</th><th className="py-2 pr-3 text-right">Sched. var</th>
                  {marginsVisible && <th className="py-2 pr-3 text-right">Margin T/C</th>}
                  <th className="py-2 pr-3 text-center">High risks</th><th className="py-2 pr-3">Next milestone</th><th className="py-2 pr-3">RAG</th><th className="py-2 pr-3">Key update</th>
                  {canRegister && <th />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const el = phElapsedPct(p.start, p.end, todayISO);
                  const sv = phScheduleVar(p.totalStories, p.doneStories, el);
                  const bv = phBurnVsPlan(weeklyHealth.filter((w) => w.projectId === p.id));
                  const lw = latestWeekly(p.id);
                  const hr = phHighRisks(raid, p.id);
                  const editing = regEdit && regEdit.id === p.id;
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="py-2 pr-3 font-medium text-slate-800">{p.name}</td>
                      <td className="py-2 pr-3">{p.pm || "—"}</td>
                      <td className="py-2 pr-3">{p.currentPhase || "—"}</td>
                      <td className={"py-2 pr-3 text-right " + (el !== null && el > 1 ? "font-semibold text-red-600" : "")}>{pc(el)}</td>
                      <td className="py-2 pr-3 text-right">
                        {editing ? (
                          <span className="inline-flex items-center gap-1">
                            <input type="number" min="0" style={{ width: 58 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" value={regEdit.doneStories} onChange={(e) => setRegEdit({ ...regEdit, doneStories: e.target.value })} />
                            /
                            <input type="number" min="0" style={{ width: 58 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" value={regEdit.totalStories} onChange={(e) => setRegEdit({ ...regEdit, totalStories: e.target.value })} />
                          </span>
                        ) : <span>{p.doneStories ?? "—"} / {p.totalStories ?? "—"}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">{pc(sv.completion)}</td>
                      <td className={"py-2 pr-3 text-right " + (bv !== null && bv > 0 ? "text-red-600" : "text-slate-600")}>{pc(bv)}</td>
                      <td className={"py-2 pr-3 text-right " + (sv.variance !== null && sv.variance < 0 ? "font-medium text-red-600" : "text-slate-600")}>{pc(sv.variance)}</td>
                      {marginsVisible && (
                        <td className="py-2 pr-3 text-right">
                          {editing ? (
                            <input type="number" min="0" max="100" step="0.1" style={{ width: 64 }} className="rounded border border-slate-200 px-1 py-0.5 text-right" placeholder="current" value={regEdit.currentMargin} onChange={(e) => setRegEdit({ ...regEdit, currentMargin: e.target.value })} />
                          ) : <span>{p.targetMargin ?? "—"} / {p.currentMargin ?? "—"}{p.targetMargin != null && p.currentMargin != null && <span className={"ml-1 text-xs " + (p.currentMargin < p.targetMargin ? "text-red-600" : "text-emerald-700")}>({p.currentMargin >= p.targetMargin ? "+" : ""}{Math.round((p.currentMargin - p.targetMargin) * 10) / 10})</span>}</span>}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-center">{hr ? <Pill tone="bg-red-100 text-red-800">{hr}</Pill> : <span className="text-slate-300">0</span>}</td>
                      <td className="py-2 pr-3 text-xs">
                        {(() => {
                          const nm = milestones.filter((m) => m.projectId === p.id && m.status !== "Complete").sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1))[0];
                          if (!nm) return <span className="text-slate-300">—</span>;
                          const late = nm.planned && nm.planned < todayISO;
                          return <span className={late ? "font-medium text-red-600" : "text-slate-600"}>{nm.name}{nm.planned ? " · " + fmt(nm.planned) : ""}{late ? " (overdue)" : ""}</span>;
                        })()}
                      </td>
                      <td className="py-2 pr-3">{lw ? <Pill tone={ragTone[lw.rag]}>{lw.rag}</Pill> : <span className="text-xs text-slate-400">no entry</span>}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600" style={{ maxWidth: 260 }}>
                        {editing ? <input className={inputCls + " py-1"} value={regEdit.keyUpdate} onChange={(e) => setRegEdit({ ...regEdit, keyUpdate: e.target.value })} /> : (p.keyUpdate || <span className="text-slate-300">—</span>)}
                        {lw && lw.oneLiner && !editing && <div className="mt-0.5 text-slate-400">wk: {lw.oneLiner}</div>}
                      </td>
                      {canRegister && (
                        <td className="py-2 text-right">
                          {editing ? (
                            <span className="flex justify-end gap-1"><Btn small onClick={() => saveRegister(p)}>Save</Btn><Btn small kind="ghost" onClick={() => setRegEdit(null)}>✕</Btn></span>
                          ) : <Btn small kind="ghost" onClick={() => setRegEdit({ id: p.id, totalStories: p.totalStories ?? "", doneStories: p.doneStories ?? "", currentMargin: p.currentMargin ?? "", keyUpdate: p.keyUpdate || "" })}>Edit</Btn>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">Derived on render: elapsed = (today − start) ÷ (end − start) · task completion = done ÷ total stories · burn vs plan = Σburnt ÷ Σplanned − 1 · schedule variance = completion − elapsed. Stories, current margin and key update are PM-maintained here; dates, PM and phase come from the project master.{marginsVisible ? "" : " Margin columns are visible to PM and Admin only."}</p>
        </Card>
        <Card title={"Open risks & issues — High impact across the portfolio (" + openHigh.length + ")"}>
          {openHigh.length === 0 ? <p className="text-sm text-slate-500">Nothing high-impact open. RAID entries are managed on each project (Projects → RAID log).</p> : (
            <ul className="divide-y divide-slate-100">
              {openHigh.sort((a, b) => (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1).map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Pill tone={x.type === "Risk" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>{x.type}</Pill>
                  <span className="font-medium text-slate-700">{pName(x.projectId)}</span>
                  <span className="text-slate-600">{x.desc}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                    {x.owner && <span>{x.owner}</span>}
                    {x.targetDate && <span className={x.targetDate < todayISO ? "font-medium text-red-600" : ""}>{fmt(x.targetDate)}</span>}
                    <Pill tone={x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>{x.status}</Pill>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </>
      )}

      {tab === "weekly" && (
        <>
        {canWeekly && (
          <Card title={wEditId ? "Edit weekly health entry" : "Weekly health entry"}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Project">
                <select className={inputCls} value={effWPid} onChange={(e) => setWf({ ...wf, projectId: e.target.value })}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Week ending"><input type="date" className={inputCls} value={wf.week} onChange={(e) => setWf({ ...wf, week: e.target.value })} /></Field>
              <Field label="Hours planned"><input type="number" min="0" className={inputCls} value={wf.hoursPlanned} onChange={(e) => setWf({ ...wf, hoursPlanned: e.target.value })} /></Field>
              <Field label="Hours burnt"><input type="number" min="0" className={inputCls} value={wf.hoursBurnt} onChange={(e) => setWf({ ...wf, hoursBurnt: e.target.value })} /></Field>
              <Field label="RAG"><select className={inputCls} value={wf.rag} onChange={(e) => setWf({ ...wf, rag: e.target.value })}>{RAG_OPTS.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={wf.scopeChanges} onChange={(e) => setWf({ ...wf, scopeChanges: e.target.checked })} />
                Scope changes this week
              </label>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-1">
              <Field label="One-liner (leadership summary)"><input className={inputCls} value={wf.oneLiner} onChange={(e) => setWf({ ...wf, oneLiner: e.target.value })} /></Field>
            </div>
            <p className="mt-1 text-xs text-slate-400">Risks and milestones aren't entered here — they live on the project (Projects → RAID log / Milestones) and the portfolio reads them from there.</p>
            <div className="mt-3 flex gap-2">
              <Btn small onClick={saveWeekly}>{wEditId ? "Save changes" : "Add entry"}</Btn>
              {wEditId && <Btn small kind="ghost" onClick={() => { setWEditId(null); setWf({ ...emptyW, projectId: effWPid }); }}>Cancel</Btn>}
            </div>
          </Card>
        )}
        <Card title="Weekly history" right={
          <select className={inputCls + " w-48"} value={whProj} onChange={(e) => setWhProj(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>}>
          {whRows.length === 0 ? <p className="text-sm text-slate-500">No weekly entries yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Week ending</th><th className="py-2 pr-3">Project</th><th className="py-2 pr-3 text-right">Planned</th><th className="py-2 pr-3 text-right">Burnt</th>
                    <th className="py-2 pr-3 text-right">Effort var</th><th className="py-2 pr-3 text-center">Scope Δ</th><th className="py-2 pr-3">RAG</th><th className="py-2 pr-3">One-liner</th>{canWeekly && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {whPage.map((w) => {
                    const ev = phEffortVar(w.hoursPlanned, w.hoursBurnt);
                    return (
                      <tr key={w.id}>
                        <td className="py-1.5 pr-3 font-medium">{fmt(w.week)}</td>
                        <td className="py-1.5 pr-3">{pName(w.projectId)}</td>
                        <td className="py-1.5 pr-3 text-right">{w.hoursPlanned}</td>
                        <td className="py-1.5 pr-3 text-right">{w.hoursBurnt}</td>
                        <td className={"py-1.5 pr-3 text-right " + (ev !== null && ev > 0 ? "text-red-600" : "text-slate-600")}>{ev === null ? "—" : (ev > 0 ? "+" : "") + Math.round(ev * 1000) / 10 + "%"}</td>
                        <td className="py-1.5 pr-3 text-center">{w.scopeChanges ? <Pill tone="bg-amber-100 text-amber-800">Y</Pill> : <span className="text-slate-300">N</span>}</td>
                        <td className="py-1.5 pr-3"><Pill tone={ragTone[w.rag]}>{w.rag}</Pill></td>
                        <td className="py-1.5 pr-3 text-xs text-slate-600">{w.oneLiner || "—"}</td>
                        {canWeekly && (
                          <td className="py-1.5 text-right">
                            <span className="flex justify-end gap-1">
                              <Btn small kind="ghost" onClick={() => { setWEditId(w.id); setWf({ projectId: w.projectId, week: w.week, hoursPlanned: w.hoursPlanned, hoursBurnt: w.hoursBurnt, scopeChanges: w.scopeChanges, rag: w.rag, oneLiner: w.oneLiner }); }}>Edit</Btn>
                              <Btn small kind="danger" onClick={() => setWeeklyHealth(weeklyHealth.filter((x) => x.id !== w.id))}>✕</Btn>
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {whPager}
            </div>
          )}
        </Card>
        </>
      )}

      {tab === "pipeline" && (
        <>
        {canPipeline && (
          <Card title={pEditId ? "Edit opportunity" : "New opportunity"}>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="Company / opportunity"><input className={inputCls} value={pf2.company} onChange={(e) => setPf2({ ...pf2, company: e.target.value })} /></Field>
              <Field label="Stage"><select className={inputCls} value={pf2.stage} onChange={(e) => setPf2({ ...pf2, stage: e.target.value })}>{PH_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Potential start"><input className={inputCls} value={pf2.potentialStart} onChange={(e) => setPf2({ ...pf2, potentialStart: e.target.value })} placeholder="date or ??" /></Field>
              <Field label="Potential resources"><input type="number" min="0" className={inputCls} value={pf2.potentialResources} onChange={(e) => setPf2({ ...pf2, potentialResources: e.target.value })} /></Field>
              <Field label="Next action"><input className={inputCls} value={pf2.nextAction} onChange={(e) => setPf2({ ...pf2, nextAction: e.target.value })} /></Field>
              <Field label="Commentary"><input className={inputCls} value={pf2.commentary} onChange={(e) => setPf2({ ...pf2, commentary: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex gap-2">
              <Btn small onClick={savePipeline}>{pEditId ? "Save changes" : "Add opportunity"}</Btn>
              {pEditId && <Btn small kind="ghost" onClick={() => { setPEditId(null); setPf2(emptyP); }}>Cancel</Btn>}
            </div>
          </Card>
        )}
        <Card title="Pipeline board">
          {pipeline.length === 0 ? <p className="text-sm text-slate-500">No opportunities yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Potential start</th><th className="py-2 pr-3 text-right">Resources</th><th className="py-2 pr-3">Next action</th><th className="py-2 pr-3">Commentary</th>{canPipeline && <th />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...pipeline].sort((a, b) => PH_STAGES.indexOf(b.stage) - PH_STAGES.indexOf(a.stage)).map((x) => (
                    <tr key={x.id}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{x.company}</td>
                      <td className="py-1.5 pr-3"><Pill tone={x.stage === "SOW Signed" ? "bg-emerald-100 text-emerald-800" : x.stage === "Closed" ? "bg-slate-200 text-slate-500" : "bg-sky-100 text-sky-800"}>{x.stage}</Pill></td>
                      <td className="py-1.5 pr-3">{x.potentialStart || "—"}</td>
                      <td className="py-1.5 pr-3 text-right">{x.potentialResources ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-600">{x.nextAction || "—"}</td>
                      <td className="py-1.5 pr-3 text-xs text-slate-500">{x.commentary || "—"}</td>
                      {canPipeline && (
                        <td className="py-1.5 text-right">
                          <span className="flex justify-end gap-1">
                            <Btn small kind="ghost" onClick={() => { setPEditId(x.id); setPf2({ company: x.company, stage: x.stage, potentialStart: x.potentialStart || "", potentialResources: x.potentialResources ?? "", commentary: x.commentary || "", nextAction: x.nextAction || "" }); }}>Edit</Btn>
                            <Btn small kind="danger" onClick={() => setPipeline(pipeline.filter((y) => y.id !== x.id))}>✕</Btn>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </>
      )}
    </div>
  );
}

// ============================================================
// TEAM PLANS (Lead / PM / Admin manage · Viewer browses)
// ============================================================
function TeamPlansView(ctx) {
  const { plans, setPlans, projects, nextId, user, todayISO } = ctx;
  const canManage = ctx.can("plans.manage");
  const [openId, setOpenId] = useState(null);
  const [showArch, setShowArch] = useState(false);
  const [nform, setNform] = useState({ name: "", projectId: projects[0] ? projects[0].id : "", phase: "", startYm: todayISO.slice(0, 7), monthsCount: 6, mult: 20 });
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const mLab = (ym) => parseISO(ym + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  const open = plans.find((p) => p.id === openId);

  const effNfPid = projById[nform.projectId] ? nform.projectId : (projects[0] ? projects[0].id : "");
  function createPlan() {
    setMsg(null);
    const proj = projById[effNfPid];
    if (!proj) return setMsg({ tone: "error", text: "Pick a project." });
    const count = Math.max(1, Math.min(12, Number(nform.monthsCount) || 6));
    const plan = {
      id: nextId("tp"),
      name: nform.name.trim() || proj.name + (nform.phase ? " " + nform.phase : "") + " — " + mLab(nform.startYm),
      projectId: effNfPid, phase: nform.phase || null,
      startYm: nform.startYm, monthsCount: count,
      mult: Number(nform.mult) || 20, multOverrides: {},
      rows: [], archived: false,
      createdBy: user.name, createdAt: todayISO, updatedAt: todayISO,
    };
    setPlans([...plans, plan]);
    setOpenId(plan.id);
    setMsg({ tone: "ok", text: "Plan \"" + plan.name + "\" created — add stream rows below." });
  }
  const patchPlan = (id, fn) => setPlans(plans.map((p) => (p.id === id ? { ...fn({ ...p }), updatedAt: todayISO } : p)));

  // ---------- editor ----------
  if (open) {
    const proj = projById[open.projectId] || { name: "?", streams: [] };
    const months = planMonths(open.startYm, open.monthsCount);
    const calc = planCalc(open);
    const hasStreams = (proj.streams || []).length > 0;
    const setRow = (rid, fn) => patchPlan(open.id, (p) => ({ ...p, rows: p.rows.map((r) => (r.id === rid ? fn({ ...r }) : r)) }));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
            {open.name} <span className="ml-2 text-sm font-normal text-slate-500">{proj.name}{open.phase ? " · " + open.phase : ""} · {mLab(months[0])} – {mLab(months[months.length - 1])}</span>
            {open.archived && <Pill tone="ml-2 bg-slate-200 text-slate-600">Archived</Pill>}
          </h2>
          <div className="flex gap-2">
            <Btn kind="ghost" small onClick={() => {
              downloadXlsx("team-plan-" + open.name.replace(/[^\w]+/g, "_") + ".xlsx", [["Plan", [
                ["Stream / label", "Task", "Expected start", "Expected end", "Estimated effort (d)", ...months.map(mLab), "Total res", "Effort by resources (d)", "Variance (d)"],
                ...open.rows.map((r, ri) => [r.stream || "", r.task || "", r.start || "", r.end || "", calc.rows[ri].est ?? "", ...months.map((_, i) => Number(r.res[i]) || 0), calc.rows[ri].resTotal, calc.rows[ri].effort, calc.rows[ri].variance ?? ""]),
                ["Multiplier (days/month)", "", "", "", "", ...months.map((_, i) => calc.multFor(i)), "", "", ""],
                ["Total Resources / month", "", "", "", calc.grandEst || "", ...calc.totalRes, calc.grandRes, calc.grandEffort, ""],
                ["Total Person Days / month", "", "", "", "", ...calc.projEffort, "", calc.grandEffort, ""],
                ["Total Person Hours / month", "", "", "", "", ...calc.projEffort.map((x) => x * 8), "", calc.grandEffort * 8, ""],
                ["Difference (res vs prev month)", "", "", "", "", ...calc.totalRes.map((x, i) => (i === 0 ? "" : Math.round((x - calc.totalRes[i - 1]) * 100) / 100)), "", "", ""],
              ]]]);
            }}>⬇ Excel</Btn>
            <Btn kind="ghost" small onClick={() => { setOpenId(null); setMsg(null); }}>← All plans</Btn>
          </div>
        </div>
        {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
        {!canManage && <Notice tone="warn">Read-only — your role can browse this plan but not change it.</Notice>}
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3" style={{ minWidth: 140 }}>{hasStreams ? "Stream" : "Project label"}</th>
                  <th className="py-2 pr-3" style={{ minWidth: 150 }}>Task description</th>
                  <th className="px-2 py-2" style={{ minWidth: 90 }}>Expected start</th>
                  <th className="px-2 py-2" style={{ minWidth: 90 }}>Expected end</th>
                  <th className="px-2 py-2 text-center">Estimated (d)</th>
                  {months.map((ym) => <th key={ym} className="border-l border-slate-100 px-2 py-2 text-center">{mLab(ym)}</th>)}
                  <th className="border-l border-slate-200 px-2 py-2 text-right">Res</th>
                  <th className="px-2 py-2 text-right">Effort by resources (d)</th>
                  <th className="px-2 py-2 text-right">Δ vs est</th>
                  {canManage && <th />}
                </tr>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th colSpan={5} className="py-1 pr-3 font-normal">Multiplier (days/month · blank = {open.mult})</th>
                  {months.map((ym, i) => (
                    <th key={ym} className="border-l border-slate-100 px-1 py-1 text-center font-normal">
                      {canManage ? (
                        <input type="number" min="1" max="31" placeholder={String(open.mult)} style={{ width: 48 }}
                          value={open.multOverrides[i] ?? ""}
                          onChange={(e) => patchPlan(open.id, (p) => ({ ...p, multOverrides: { ...p.multOverrides, [i]: e.target.value === "" ? null : Number(e.target.value) } }))}
                          className="rounded border border-slate-200 px-1 py-0.5 text-center" />
                      ) : <span>{calc.multFor(i)}</span>}
                    </th>
                  ))}
                  <th colSpan={canManage ? 5 : 4} className="px-2 py-1 text-right font-normal">
                    {canManage && <span className="mr-2">default ×
                      <input type="number" min="1" max="31" style={{ width: 48 }} value={open.mult}
                        onChange={(e) => patchPlan(open.id, (p) => ({ ...p, mult: Number(e.target.value) || 20 }))}
                        className="ml-1 rounded border border-slate-200 px-1 py-0.5 text-center" /></span>}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {open.rows.map((r, ri) => (
                  <tr key={r.id}>
                    <td className="py-1 pr-3">
                      {canManage ? (
                        hasStreams ? (
                          <select className={inputCls + " py-1"} value={(proj.streams || []).includes(r.stream) ? r.stream : "__custom"}
                            onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value === "__custom" ? (x.stream && !(proj.streams || []).includes(x.stream) ? x.stream : "") : e.target.value }))}>
                            {(proj.streams || []).map((s) => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom">Custom label…</option>
                          </select>
                        ) : (
                          <input className={inputCls + " py-1"} value={r.stream || ""} placeholder="Project label" onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value }))} />
                        )
                      ) : <Pill tone={STREAM_COLORS[r.stream] || "bg-slate-100 text-slate-600"}>{r.stream || "—"}</Pill>}
                      {canManage && hasStreams && !(proj.streams || []).includes(r.stream) && (
                        <input className={inputCls + " mt-1 py-1"} value={r.stream || ""} placeholder="Custom label" onChange={(e) => setRow(r.id, (x) => ({ ...x, stream: e.target.value }))} />
                      )}
                    </td>
                    <td className="py-1 pr-3">
                      {canManage ? <input className={inputCls + " py-1"} value={r.task || ""} placeholder="What this covers" onChange={(e) => setRow(r.id, (x) => ({ ...x, task: e.target.value }))} />
                        : <span className="text-slate-600">{r.task || "—"}</span>}
                    </td>
                    <td className="px-1 py-1">
                      {canManage ? <input className={inputCls + " py-1"} style={{ minWidth: 84 }} value={r.start || ""} placeholder="e.g. Aug '26" onChange={(e) => setRow(r.id, (x) => ({ ...x, start: e.target.value }))} />
                        : <span className="text-slate-500">{r.start || "—"}</span>}
                    </td>
                    <td className="px-1 py-1">
                      {canManage ? <input className={inputCls + " py-1"} style={{ minWidth: 84 }} value={r.end || ""} placeholder="e.g. Jan '27" onChange={(e) => setRow(r.id, (x) => ({ ...x, end: e.target.value }))} />
                        : <span className="text-slate-500">{r.end || "—"}</span>}
                    </td>
                    <td className="px-1 py-1 text-center">
                      {canManage ? (
                        <input type="number" min="0" style={{ width: 78 }} value={r.est ?? ""} placeholder="est."
                          onChange={(e) => setRow(r.id, (x) => ({ ...x, est: e.target.value === "" ? null : Number(e.target.value) }))}
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center font-medium text-white placeholder:text-slate-500" />
                      ) : <span className="font-medium">{calc.rows[ri].est ?? "—"}</span>}
                    </td>
                    {months.map((ym, i) => (
                      <td key={ym} className="border-l border-slate-100 px-1 py-1 text-center">
                        {canManage ? (
                          <input type="number" min="0" step="0.5" style={{ width: 58 }} value={r.res[i] ?? ""}
                            onChange={(e) => setRow(r.id, (x) => { const res = [...x.res]; res[i] = e.target.value === "" ? "" : Number(e.target.value); return { ...x, res }; })}
                            className="rounded border border-slate-200 px-1 py-1 text-center" />
                        ) : <span>{Number(r.res[i]) || <span className="text-slate-300">·</span>}</span>}
                      </td>
                    ))}
                    <td className="border-l border-slate-200 px-2 py-1 text-right font-medium">{r1(calc.rows[ri].resTotal)}</td>
                    <td className="px-2 py-1 text-right font-semibold">{r1(calc.rows[ri].effort)}<span className="ml-1 font-normal text-slate-400">{calc.rows[ri].effort * 8}h</span></td>
                    <td className="px-2 py-1 text-right">
                      {calc.rows[ri].variance === null ? <span className="text-slate-300">—</span> : (
                        <Pill tone={calc.rows[ri].variance > 0 ? "bg-amber-100 text-amber-800" : calc.rows[ri].variance < 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}>
                          {calc.rows[ri].variance > 0 ? "+" : ""}{r1(calc.rows[ri].variance)}
                        </Pill>
                      )}
                    </td>
                    {canManage && <td className="px-1 py-1 text-right"><Btn small kind="danger" onClick={() => patchPlan(open.id, (p) => ({ ...p, rows: p.rows.filter((x) => x.id !== r.id) }))}>✕</Btn></td>}
                  </tr>
                ))}
                {open.rows.length === 0 && <tr><td colSpan={months.length + 10} className="py-3 text-sm text-slate-500">No rows yet{canManage ? " — add the first stream below." : "."}</td></tr>}
                <tr className="border-t-2 border-slate-300 font-semibold">
                  <td colSpan={4} className="py-2 pr-3">Total Resources / month</td>
                  <td className="px-2 py-2 text-center text-slate-600">{calc.grandEst ? r1(calc.grandEst) : "—"}</td>
                  {calc.totalRes.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-2 text-center">{x || <span className="font-normal text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-2 text-right">{r1(calc.grandRes)}</td>
                  <td className="px-2 py-2 text-right">{r1(calc.grandEffort)}</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="py-2 pr-3">Projected Effort Spent / month (person-days)</td>
                  {calc.projEffort.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-2 text-center">{x ? r1(x) : <span className="font-normal text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-2 text-right text-slate-400">Σ</td>
                  <td className="px-2 py-2 text-right">{r1(calc.grandEffort)} d</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="text-slate-600">
                  <td colSpan={5} className="py-1.5 pr-3 font-medium">Total Person Hours / month (×8)</td>
                  {calc.projEffort.map((x, i) => <td key={i} className="border-l border-slate-100 px-1 py-1.5 text-center">{x ? r1(x * 8) : <span className="text-slate-300">·</span>}</td>)}
                  <td className="border-l border-slate-200 px-2 py-1.5 text-right text-slate-400">Σ</td>
                  <td className="px-2 py-1.5 text-right font-medium">{r1(calc.grandEffort * 8)} h</td>
                  <td colSpan={canManage ? 2 : 1} />
                </tr>
                <tr className="text-xs text-slate-500">
                  <td colSpan={5} className="py-1.5 pr-3">Δ resources vs previous month (ramp)</td>
                  {calc.totalRes.map((x, i) => {
                    if (i === 0) return <td key={i} className="border-l border-slate-100 px-1 py-1.5 text-center text-slate-300">—</td>;
                    const d = Math.round((x - calc.totalRes[i - 1]) * 100) / 100;
                    return <td key={i} className={"border-l border-slate-100 px-1 py-1.5 text-center font-medium " + (d > 0 ? "text-emerald-700" : d < 0 ? "text-red-600" : "text-slate-400")}>{d > 0 ? "+" + d : d}</td>;
                  })}
                  <td colSpan={canManage ? 4 : 3} />
                </tr>
              </tbody>
            </table>
          </div>
          {canManage && (
            <div className="mt-3">
              <Btn small kind="ghost" onClick={() => patchPlan(open.id, (p) => ({ ...p, rows: [...p.rows, { id: nextId("tr"), stream: hasStreams ? (proj.streams[0] || "") : "", task: "", start: "", end: "", res: Array.from({ length: open.monthsCount }, () => ""), est: null }] }))}>+ Add row</Btn>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">Effort by resources = Σ month resources × multiplier (sheet formula SUM(months)×{open.mult}; partial months can use fractional resources like 0.55, or a per-month multiplier override). Person hours at ×8. Estimated effort is your own figure; Δ vs est = computed − estimated. The ramp row mirrors the sheet's "Difference" — month-over-month change in total resources.</p>
        </Card>
      </div>
    );
  }

  // ---------- manage grid ----------
  const visible = plans.filter((p) => showArch || !p.archived);
  const { rows: visPage, pager: planPager } = usePaged(visible, 10);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Team Plans ({plans.length})</h2>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} />
          Show archived
        </label>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {canManage && (
        <Card title="Create team plan">
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Project">
              <select className={inputCls} value={effNfPid} onChange={(e) => setNform({ ...nform, projectId: e.target.value, phase: "" })}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Phase">
              <select className={inputCls} value={nform.phase} onChange={(e) => setNform({ ...nform, phase: e.target.value })}>
                <option value="">—</option>
                {(projById[effNfPid] ? projById[effNfPid].phases : []).map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Plan name (optional)"><input className={inputCls} value={nform.name} onChange={(e) => setNform({ ...nform, name: e.target.value })} placeholder="auto from project" /></Field>
            <Field label="Start month"><input type="month" className={inputCls} value={nform.startYm} onChange={(e) => setNform({ ...nform, startYm: e.target.value })} /></Field>
            <Field label="# months (1–12)"><input type="number" min="1" max="12" className={inputCls} value={nform.monthsCount} onChange={(e) => setNform({ ...nform, monthsCount: e.target.value })} /></Field>
            <Field label="Effort multiplier (days/mo)"><input type="number" min="1" max="31" className={inputCls} value={nform.mult} onChange={(e) => setNform({ ...nform, mult: e.target.value })} /></Field>
          </div>
          <div className="mt-3"><Btn onClick={createPlan}>Create plan</Btn></div>
        </Card>
      )}
      <Card title="All plans">
        {visible.length === 0 ? <p className="text-sm text-slate-500">No plans yet{canManage ? " — create the first one above." : "."}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Project · Phase</th><th className="py-2 pr-4">Window</th>
                  <th className="py-2 pr-4 text-right">Rows</th><th className="py-2 pr-4 text-right">Projected (d)</th><th className="py-2 pr-4 text-right">Estimated (d)</th>
                  <th className="py-2 pr-4">Updated</th><th className="py-2 pr-4">Status</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visPage.map((p) => {
                  const c = planCalc(p);
                  const proj = projById[p.projectId];
                  const months = planMonths(p.startYm, p.monthsCount);
                  return (
                    <tr key={p.id} className={p.archived ? "text-slate-400" : ""}>
                      <td className="py-2 pr-4 font-medium">{p.name}</td>
                      <td className="py-2 pr-4">{proj ? proj.name : "?"}{p.phase ? " · " + p.phase : ""}</td>
                      <td className="py-2 pr-4 text-slate-500">{mLab(months[0])} – {mLab(months[months.length - 1])}</td>
                      <td className="py-2 pr-4 text-right">{p.rows.length}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{r1(c.grandEffort)}</td>
                      <td className="py-2 pr-4 text-right">{c.grandEst ? r1(c.grandEst) : "—"}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{fmt(p.updatedAt)} · {p.createdBy}</td>
                      <td className="py-2 pr-4">{p.archived ? <Pill tone="bg-slate-200 text-slate-600">Archived</Pill> : <Pill tone="bg-emerald-100 text-emerald-800">Active</Pill>}</td>
                      <td className="py-2 text-right">
                        <span className="flex justify-end gap-2">
                          <Btn small kind="ghost" onClick={() => { setOpenId(p.id); setMsg(null); }}>{canManage && !p.archived ? "Open / edit" : "View"}</Btn>
                          {canManage && <Btn small kind="ghost" onClick={() => {
                            const copy = { ...p, id: nextId("tp"), name: p.name + " (scenario)", archived: false, createdBy: user.name, createdAt: todayISO, updatedAt: todayISO, rows: p.rows.map((r) => ({ ...r, id: nextId("tr"), res: [...r.res] })), multOverrides: { ...p.multOverrides } };
                            setPlans([...plans, copy]);
                            setMsg({ tone: "ok", text: "Duplicated as \"" + copy.name + "\" — the sheet's scenario blocks (e.g. \"Till January — With Onboarding\") live as separate plans here." });
                          }}>Duplicate</Btn>}
                          {canManage && <Btn small kind="ghost" onClick={() => patchPlan(p.id, (x) => ({ ...x, archived: !x.archived }))}>{p.archived ? "Unarchive" : "Archive"}</Btn>}
                          {canManage && <Btn small kind="danger" onClick={() => setPlans(plans.filter((x) => x.id !== p.id))}>Delete</Btn>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {planPager}
      </Card>
    </div>
  );
}

// ============================================================
// PERFORMANCE (Lead / PM / Admin — never visible to Developers)
// ============================================================
function PerformanceView(ctx) {
  const { scores, setScores, perfCfg, setPerfCfg, employees, tcRows, tcWeeks, jiraFlags, nextId, isAdmin, todayISO } = ctx;
  const PARTNERS = ["WeKan", "Ciklum", "Globant"];
  const pWeeks = useMemo(() => [...new Set([...tcWeeks, ...scores.map((s) => s.week)])].sort(), [tcWeeks, scores]);
  const [week, setWeek] = useState(pWeeks[pWeeks.length - 1] || todayISO);
  const [q, setQ] = useState("");
  const [co, setCo] = useState("All");
  const [draft, setDraft] = useState(null); // admin config draft
  const [msg, setMsg] = useState(null);
  const [ptab, setPtab] = useState("scoring"); // scoring | reports
  const [rpt, setRpt] = useState("scorecard"); // scorecard | vendors | resource
  const [rptName, setRptName] = useState("");
  const r2 = (x) => Math.round(x * 100) / 100;

  const pool = employees
    .filter((e) => isActiveDuring(e, week, week))
    .filter((e) => (perfCfg.partnerOnly ? PARTNERS.includes(e.company) : true))
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (co === "All" || e.company === co))
    .sort((a, b) => a.name.localeCompare(b.name));
  const scoreFor = (name) => scores.find((s) => s.name === name && s.week === week);
  function setMetric(name, idx, val) {
    const v = val === "" ? null : Number(val);
    const ex = scoreFor(name);
    if (ex) setScores(scores.map((s) => (s.id === ex.id ? { ...s, m: s.m.map((x, i) => (i === idx ? v : x)) } : s)));
    else {
      const m = [null, null, null, null, null, null];
      m[idx] = v;
      setScores([...scores, { id: nextId("s"), name, week, m }]);
    }
  }
  const canScore = ctx.can("perf.score");
  const tcPctByName = useMemo(() => {
    const out = {};
    tcRows.forEach((r) => { out[r.name] = tcStatsFlex(r.weeks, jiraFlags[r.id]).pct; });
    return out;
  }, [tcRows, jiraFlags]);

  const weekScores = pool.map((e) => {
    const s = scoreFor(e.name);
    const score = s ? weightedScore(s.m, perfCfg.weights) : null;
    return { e, s, score, rag: ragOf(score, perfCfg) };
  });
  const { rows: wsPage, pager: wsPager } = usePaged(weekScores, 25);
  const scored = weekScores.filter((x) => x.score !== null);
  const avg = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : null;
  const rag = { Green: 0, Amber: 0, Red: 0 };
  scored.forEach((x) => rag[x.rag]++);
  const watch = scored.filter((x) => x.rag !== "Green").sort((a, b) => a.score - b.score);
  const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
  const starsText = (st) => st === null ? "" : "★".repeat(Math.floor(st)) + (st % 1 ? "½" : "");

  function applyCfg() {
    setMsg(null);
    const w = draft.weights.map(Number);
    const tot = w.reduce((s, x) => s + x, 0);
    if (tot !== 100) return setMsg({ tone: "error", text: "Weights must total exactly 100 — currently " + tot + "." });
    if (Number(draft.green) <= Number(draft.amber)) return setMsg({ tone: "error", text: "Green threshold must be above Amber." });
    setPerfCfg({ weights: w, green: Number(draft.green), amber: Number(draft.amber), partnerOnly: draft.partnerOnly });
    setDraft(null);
    setMsg({ tone: "ok", text: "Scoring configuration updated — all scores recalculated." });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Partner Performance</h2>
        <div className="flex flex-wrap gap-2">
          {ctx.can("perf.reports") && (
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {[["scoring", "Scoring"], ["reports", "Reports & Export"]].map(([v, lab]) => (
                <button key={v} onClick={() => setPtab(v)}
                  className={"px-4 py-2 text-sm font-medium transition " + (ptab === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                  {lab}
                </button>
              ))}
            </div>
          )}
          <select className={inputCls + " w-52"} value={week} onChange={(e) => setWeek(e.target.value)}>
            {pWeeks.map((w) => <option key={w} value={w}>week ending {fmtShort(w)}</option>)}
          </select>
          <input className={inputCls + " w-40"} placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputCls + " w-28"} value={co} onChange={(e) => setCo(e.target.value)}>
            {["All", ...(perfCfg.partnerOnly ? PARTNERS : ["MDB", ...PARTNERS])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {ptab === "reports" && ctx.can("perf.reports") && (() => {
        const cfg = perfCfg;
        const sc = perfScorecard(employees, scores, week, cfg);
        const vt = perfVendorTrend(employees, scores, cfg);
        const names = [...new Set(scores.map((s) => s.name))].sort();
        const person = names.includes(rptName) ? rptName : names[0] || "";
        const trend = person ? perfResourceTrend(scores, person, cfg) : [];
        const r2b = (x) => (x === null || x === undefined ? "" : Math.round(x * 100) / 100);
        const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
        function exportExcel() {
          if (rpt === "scorecard") {
            downloadXlsx("performance-scorecard-" + week + ".xlsx", [
              ["Scorecard", [["Resource", "Vendor", ...METRICS, "Weighted", "Stars", "RAG"], ...sc.rows.map((r) => [r.name, r.vendor, ...r.m.map((x) => (x === null ? "" : x)), r2b(r.score), r.stars === null ? "" : r.stars, r.rag || ""])]],
              ["Vendor summary", [["Vendor", "Resources", "Scored", "Avg", "Green", "Amber", "Red"], ...Object.entries(sc.vendors).map(([v, x]) => [v, x.total, x.scored, r2b(x.avg), x.Green, x.Amber, x.Red])]],
            ]);
          } else if (rpt === "vendors") {
            downloadXlsx("vendor-comparison.xlsx", [["Weekly averages", [["Vendor", ...vt.weeks], ...Object.entries(vt.vendors).map(([v, arr]) => [v, ...arr.map(r2b)])]]]);
          } else {
            downloadXlsx("resource-trend-" + person.replace(/\s+/g, "_") + ".xlsx", [[person.slice(0, 31), [["Week", ...METRICS, "Weighted", "Stars", "RAG"], ...trend.map((t) => [t.week, ...t.m.map((x) => (x === null ? "" : x)), r2b(t.score), t.stars === null ? "" : t.stars, t.rag || ""])]]]);
          }
        }
        return (
          <>
            <div className="no-print flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-slate-300">
                {[["scorecard", "Weekly Scorecard"], ["vendors", "Vendor Comparison"], ["resource", "Resource Trend"]].map(([v, lab]) => (
                  <button key={v} onClick={() => setRpt(v)}
                    className={"px-3 py-2 text-sm font-medium transition " + (rpt === v ? "mdb-btn-primary text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                    {lab}
                  </button>
                ))}
              </div>
              {rpt === "resource" && (
                <select className={inputCls + " w-56"} value={person} onChange={(e) => setRptName(e.target.value)}>
                  {names.map((n) => <option key={n}>{n}</option>)}
                </select>
              )}
              <span className="ml-auto flex gap-2">
                <Btn kind="ghost" small onClick={exportExcel}>⬇ Excel</Btn>
                <Btn small onClick={() => window.print()}>Print / Save as PDF</Btn>
              </span>
            </div>
            <div className="print-area rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>
                    {rpt === "scorecard" ? "Partner Performance Scorecard — week ending " + fmt(week) : rpt === "vendors" ? "Vendor Performance Comparison" : "Resource Performance Trend — " + person}
                  </div>
                  <div className="text-xs text-slate-500">AMP APAC · generated {fmt(todayISO)} · weights {METRICS.map((mn, i) => mn + " " + perfCfg.weights[i] + "%").join(" · ")} · RAG Green ≥ {perfCfg.green}, Amber ≥ {perfCfg.amber}</div>
                </div>
                <Leaf size={26} />
              </div>
              {rpt === "scorecard" && (
                <>
                  <table className="mb-4 w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Vendor</th><th className="py-1.5 pr-3 text-right">Resources</th><th className="py-1.5 pr-3 text-right">Scored</th><th className="py-1.5 pr-3 text-right">Avg</th><th className="py-1.5 pr-3 text-right">Green</th><th className="py-1.5 pr-3 text-right">Amber</th><th className="py-1.5 pr-3 text-right">Red</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(sc.vendors).map(([v, x]) => (
                        <tr key={v}><td className="py-1 pr-3 font-medium">{v}</td><td className="py-1 pr-3 text-right">{x.total}</td><td className="py-1 pr-3 text-right">{x.scored}</td><td className="py-1 pr-3 text-right font-semibold">{r2b(x.avg) || "—"}</td><td className="py-1 pr-3 text-right text-emerald-700">{x.Green}</td><td className="py-1 pr-3 text-right text-amber-700">{x.Amber}</td><td className="py-1 pr-3 text-right text-red-700">{x.Red}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Resource</th><th className="py-1.5 pr-3">Vendor</th>
                      {METRICS.map((mn) => <th key={mn} className="py-1.5 pr-2 text-center">{mn.slice(0, 5)}</th>)}
                      <th className="py-1.5 pr-3 text-right">Score</th><th className="py-1.5 pr-3">RAG</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {sc.rows.map((r) => (
                        <tr key={r.name}>
                          <td className="py-1 pr-3 font-medium">{r.name}</td><td className="py-1 pr-3 text-slate-500">{r.vendor}</td>
                          {r.m.map((x, i) => <td key={i} className="py-1 pr-2 text-center">{x === null ? "·" : x}</td>)}
                          <td className="py-1 pr-3 text-right font-semibold">{r.score === null ? "—" : r2b(r.score)}</td>
                          <td className="py-1 pr-3">{r.rag ? <Pill tone={RAG_TONE[r.rag]}>{r.rag}</Pill> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {rpt === "vendors" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 pr-3">Vendor</th>
                    {vt.weeks.map((w) => <th key={w} className="py-1.5 pr-2 text-center">{fmtShort(w)}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(vt.vendors).map(([v, arr]) => (
                      <tr key={v}>
                        <td className="py-1 pr-3 font-medium">{v}</td>
                        {arr.map((x, i) => (
                          <td key={i} className="py-1 pr-2 text-center">
                            {x === null ? <span className="text-slate-300">·</span> : <span className={x >= perfCfg.green ? "font-semibold text-emerald-700" : x >= perfCfg.amber ? "text-amber-700" : "font-semibold text-red-700"}>{r2b(x)}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {rpt === "resource" && (
                trend.length === 0 ? <p className="text-sm text-slate-500">No scores recorded for {person} yet.</p> : (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Week</th>
                      {METRICS.map((mn) => <th key={mn} className="py-1.5 pr-2 text-center">{mn.slice(0, 5)}</th>)}
                      <th className="py-1.5 pr-3 text-right">Score</th><th className="py-1.5 pr-3">Stars</th><th className="py-1.5 pr-3">RAG</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {trend.map((t) => (
                        <tr key={t.week}>
                          <td className="py-1 pr-3 font-medium">{fmtShort(t.week)}</td>
                          {t.m.map((x, i) => <td key={i} className="py-1 pr-2 text-center">{x === null ? "·" : x}</td>)}
                          <td className="py-1 pr-3 text-right font-semibold">{t.score === null ? "—" : r2b(t.score)}</td>
                          <td className="py-1 pr-3 text-amber-500">{t.stars === null ? "" : "★".repeat(Math.floor(t.stars)) + (t.stars % 1 ? "½" : "")}</td>
                          <td className="py-1 pr-3">{t.rag ? <Pill tone={RAG_TONE[t.rag]}>{t.rag}</Pill> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
              <p className="mt-4 border-t border-slate-100 pt-2 text-xs text-slate-400">Confidential — for MongoDB AMP APAC delivery governance. Generated from DeliveryHub.</p>
            </div>
          </>
        );
      })()}
      {ptab === "scoring" && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scored this week" value={scored.length + " / " + pool.length} sub={perfCfg.partnerOnly ? "partner resources" : "all resources"} />
        <Stat label="Avg weighted score" value={avg === null ? "—" : r2(avg)} sub="out of 5" />
        <Stat label="Green / Amber" value={rag.Green + " / " + rag.Amber} sub={"Green ≥ " + perfCfg.green + " · Amber ≥ " + perfCfg.amber} />
        <Stat label="Red" value={rag.Red} sub={rag.Red ? "needs attention" : "none this week"} />
      </div>
      <Card title={"Weekly scoring — " + fmt(week) + " (1 critical … 5 excellent)"}>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Resource</th><th className="py-2 pr-3">Vendor</th>
                {METRICS.map((mName, i) => <th key={mName} className="py-2 pr-2 text-center" title={mName === "Timecard" ? "Suggested from timecard proactiveness — click the grey hint to apply" : mName}>{mName}<div className="font-normal normal-case text-slate-400">{perfCfg.weights[i]}%</div></th>)}
                <th className="py-2 pr-3 text-right">Score</th><th className="py-2 pr-3">Stars</th><th className="py-2 pr-3">RAG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wsPage.map(({ e, s, score, rag: rg }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-1 pr-3 font-medium text-slate-800">{e.name}</td>
                  <td className="py-1 pr-3 text-slate-500">{e.company}</td>
                  {METRICS.map((mName, i) => {
                    const v = s && s.m[i] !== null && s.m[i] !== undefined ? s.m[i] : "";
                    const sug = mName === "Timecard" && v === "" ? tcSuggested(tcPctByName[e.name]) : null;
                    return (
                      <td key={mName} className="py-1 pr-2 text-center">
                        <span className="inline-flex items-center gap-1">
                          <select value={v} disabled={!canScore} onChange={(ev) => setMetric(e.name, i, ev.target.value)}
                            className={"w-14 rounded border border-slate-200 px-1 py-1 text-center " + (canScore ? "cursor-pointer " : "cursor-not-allowed opacity-70 ") + (v === "" ? "text-slate-300" : v >= 4 ? "bg-emerald-50 text-emerald-800" : v >= 3 ? "bg-white text-slate-700" : "bg-red-50 text-red-800")}>
                            <option value="">—</option>
                            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          {sug !== null && canScore && <button onClick={() => setMetric(e.name, i, String(sug))} title={"Apply suggestion from timecard proactiveness (" + (tcPctByName[e.name] ?? "—") + "%)"} className="rounded bg-slate-100 px-1 text-slate-400 hover:bg-slate-200">{sug}</button>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-1 pr-3 text-right font-semibold">{score === null ? <span className="font-normal text-slate-300">—</span> : r2(score)}</td>
                  <td className="whitespace-nowrap py-1 pr-3 text-amber-500">{starsText(starsOf(score))}</td>
                  <td className="py-1 pr-3">{rg ? <Pill tone={RAG_TONE[rg]}>{rg}</Pill> : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
              {pool.length === 0 && <tr><td colSpan={11} className="py-3 text-sm text-slate-500">No resources match — {perfCfg.partnerOnly ? "partner-only scoring is on (WeKan · Ciklum · Globant)" : "adjust filters"}.</td></tr>}
            </tbody>
          </table>
        </div>
        {wsPager}
        <p className="mt-2 text-xs text-slate-400">A score computes once all six metrics are filled. Grey hint next to Timecard applies the suggestion derived from that person's proactiveness %. Developers never see this module.</p>
      </Card>
      {watch.length > 0 && (
        <Card title={"Watchlist — " + fmt(week)}>
          <ul className="divide-y divide-slate-100">
            {watch.map(({ e, score, rag: rg }) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium text-slate-800">{e.name}</span><span className="ml-2 text-xs text-slate-400">{e.company}</span></span>
                <span className="flex items-center gap-2"><span className="text-xs text-slate-500">{r2(score)}</span><Pill tone={RAG_TONE[rg]}>{rg}</Pill></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {ctx.can("perf.config") && (
        <Card title="Scoring configuration (Admin)" right={!draft && <Btn small kind="ghost" onClick={() => setDraft({ weights: [...perfCfg.weights], green: perfCfg.green, amber: perfCfg.amber, partnerOnly: perfCfg.partnerOnly })}>Edit</Btn>}>
          {!draft ? (
            <p className="text-sm text-slate-600">Weights: {METRICS.map((mName, i) => mName + " " + perfCfg.weights[i] + "%").join(" · ")}. RAG: Green ≥ {perfCfg.green}, Amber ≥ {perfCfg.amber}, else Red. Scope: {perfCfg.partnerOnly ? "partner resources only (WeKan · Ciklum · Globant)" : "all resources including MDB"}.</p>
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {METRICS.map((mName, i) => (
                  <Field key={mName} label={mName + " %"}>
                    <input type="number" min="0" max="100" className={inputCls} value={draft.weights[i]}
                      onChange={(e) => setDraft({ ...draft, weights: draft.weights.map((w, j) => (j === i ? e.target.value : w)) })} />
                  </Field>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Green ≥"><input type="number" step="0.1" className={inputCls + " w-24"} value={draft.green} onChange={(e) => setDraft({ ...draft, green: e.target.value })} /></Field>
                <Field label="Amber ≥"><input type="number" step="0.1" className={inputCls + " w-24"} value={draft.amber} onChange={(e) => setDraft({ ...draft, amber: e.target.value })} /></Field>
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={draft.partnerOnly} onChange={(e) => setDraft({ ...draft, partnerOnly: e.target.checked })} />
                  Partner resources only (untick to extend to MDB)
                </label>
                <span className={"pb-2 text-sm font-medium " + (draft.weights.reduce((s, w) => s + Number(w), 0) === 100 ? "text-emerald-700" : "text-red-600")}>
                  Total: {draft.weights.reduce((s, w) => s + Number(w), 0)}%
                </span>
                <Btn onClick={applyCfg}>Apply</Btn>
                <Btn kind="ghost" onClick={() => setDraft(null)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}
      </>}
    </div>
  );
}

// ============================================================
// REMAINING RUNWAY (Lead view · PM/Admin manage funding)
// ============================================================
function RunwayView(ctx) {
  const { projects, setProjects, employees, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO } = ctx;
  const canFund = ctx.can("runway.funding");
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const r2 = (x) => Math.round(x * 100) / 100;
  const RAG_TONE = { Green: "bg-emerald-100 text-emerald-800", Amber: "bg-amber-100 text-amber-800", Red: "bg-red-100 text-red-800" };
  const anchor = weekAnchor(todayISO);

  function startEdit(p) {
    const fd = p.funding || {};
    setEditId(p.id);
    setF({ start: fd.start || todayISO, hours: { ...(fd.hours || {}) }, overrides: { ...(fd.overrides || {}) } });
  }
  function saveFunding(p) {
    setMsg(null);
    if (!f.start) return setMsg({ tone: "error", text: "Funding start date is required — consumption is counted from it." });
    const hours = {};
    const overrides = {};
    RUNWAY_ROLES.forEach((r) => {
      hours[r] = Number(f.hours[r]) || 0;
      overrides[r] = f.overrides[r] === "" || f.overrides[r] === null || f.overrides[r] === undefined ? null : Number(f.overrides[r]);
    });
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, funding: { start: f.start, hours, overrides } } : x)));
    setEditId(null);
    setMsg({ tone: "ok", text: "Funding saved for " + p.name + " — runway recalculated." });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Remaining Runway</h2>
        <span className="text-xs text-slate-500">Week anchor: {fmt(anchor)} · consumed at 8 h per working day, day-weighted across concurrent projects · last dates skip weekends & the {holidaySet.size} configured holidays and are extended by approved leave</span>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {projects.map((p) => {
        const rw = computeRunway(p, empByName, assignments, leaves, leaveTypes, weekendDays, holidaySet, todayISO);
        return (
          <Card key={p.id} title={"Runway — " + p.name + (rw && rw.end ? " · funded until " + fmt(rw.end) : "")}
            right={canFund && editId !== p.id && <Btn small kind="ghost" onClick={() => startEdit(p)}>{p.funding ? "Edit funding" : "Set up funding"}</Btn>}>
            {editId === p.id && f && (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 sm:grid-cols-5">
                  <Field label="Funding start (consumption counts from here)"><input type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
                  {RUNWAY_ROLES.map((r) => (
                    <Field key={r} label={r + " total billable hrs"}>
                      <input type="number" min="0" className={inputCls} value={f.hours[r] ?? ""} onChange={(e) => setF({ ...f, hours: { ...f.hours, [r]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-5">
                  <div className="self-end pb-2 text-xs text-slate-500">Remaining overrides (blank = derived from consumption):</div>
                  {RUNWAY_ROLES.map((r) => (
                    <Field key={r} label={r + " remaining override"}>
                      <input type="number" min="0" className={inputCls} placeholder="derived" value={f.overrides[r] ?? ""} onChange={(e) => setF({ ...f, overrides: { ...f.overrides, [r]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
                <div className="mt-3 flex gap-2"><Btn small onClick={() => saveFunding(p)}>Save funding</Btn><Btn small kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
              </div>
            )}
            {!rw ? (
              <p className="text-sm text-slate-500">No funding configured{canFund ? " — click \"Set up funding\" and enter the SOW billable hours per role." : " — the PM sets SOW billable hours per role here."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Role</th><th className="py-2 pr-3 text-right">Headcount</th><th className="py-2 pr-3 text-right">Burn / wk (h)</th>
                      <th className="py-2 pr-3 text-right">Total billable</th><th className="py-2 pr-3 text-right">Consumed</th><th className="py-2 pr-3 text-right">Remaining</th>
                      <th className="py-2 pr-3 text-right">Weeks</th><th className="py-2 pr-3 text-right">Days</th><th className="py-2 pr-3">Last date</th>
                      <th className="py-2 pr-3 text-right">Leave adj</th><th className="py-2 pr-3">RAG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rw.rows.map((r) => (
                      <tr key={r.role} className={r.headcount === 0 && !r.total ? "text-slate-300" : ""}>
                        <td className="py-1.5 pr-3 font-medium">{r.role}</td>
                        <td className="py-1.5 pr-3 text-right">{r.headcount}{r.weeklyBurn && r.headcount && r.weeklyBurn < r.headcount * 40 ? <span className="ml-1 text-xs text-slate-400" title="Some people are split across concurrent projects — burn reflects their share here">({Math.round(r.weeklyBurn / 40 * 100) / 100} FTE)</span> : null}</td>
                        <td className="py-1.5 pr-3 text-right">{r.weeklyBurn ? Math.round(r.weeklyBurn * 10) / 10 : "—"}</td>
                        <td className="py-1.5 pr-3 text-right">{r.total || "—"}</td>
                        <td className="py-1.5 pr-3 text-right text-slate-500">{r.consumed || "—"}</td>
                        <td className="py-1.5 pr-3 text-right font-semibold">{r1(r.remaining)}{r.override !== null && <Pill tone="ml-1 bg-purple-100 text-purple-800">override</Pill>}</td>
                        <td className="py-1.5 pr-3 text-right font-semibold">{r.weeks === null ? "—" : r2(r.weeks)}</td>
                        <td className="py-1.5 pr-3 text-right">{r.days === null ? "—" : r1(r.days)}</td>
                        <td className="py-1.5 pr-3 font-medium">{r.last ? fmt(r.last) : "—"}</td>
                        <td className="py-1.5 pr-3 text-right text-slate-500">{r.leaveAdj ? "+" + r1(r.leaveAdj) + " d" : "—"}</td>
                        <td className="py-1.5 pr-3">{r.rag ? <Pill tone={RAG_TONE[r.rag]}>{r.rag}</Pill> : "—"}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold">
                      <td className="py-2 pr-3">Project</td><td /><td />
                      <td className="py-2 pr-3 text-right">{RUNWAY_ROLES.reduce((s, r) => s + ((p.funding.hours || {})[r] || 0), 0)}</td>
                      <td />
                      <td className="py-2 pr-3 text-right">{r1(rw.totalRemaining)}</td>
                      <td colSpan={2} />
                      <td className="py-2 pr-3">{rw.end ? "ends " + fmt(rw.end) : "—"}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">Weeks = remaining ÷ weekly burn (per-assignment hours honoured, default 40). RAG: Green ≥ 4 weeks, Amber ≥ 2. Leave adj = approved leave of the role's team inside the runway window, extending the last date — computed from real leave records, not a manual forecast.</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// PROJECTS (Lead view · PM/Admin manage) — project master
// ============================================================
const RAID_TYPES = ["Risk", "Issue", "Dependency", "Decision"];
const HML = ["H", "M", "L"];
const RAID_STATUSES = ["Open", "In Progress", "Closed"];
const MS_STATUSES = ["Not Started", "In Progress", "Complete"];
const RAG_OPTS = ["Green", "Amber", "Red"];
const ragPill = (x) => x === "Red" ? "bg-red-100 text-red-800" : x === "Amber" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
const hmlPill = (x) => x === "H" ? "bg-red-100 text-red-800" : x === "M" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";

function RaidPanel(ctx) {
  const { raid, setRaid, project, canEdit, nextId, todayISO, user } = ctx;
  const empty = { type: "Risk", desc: "", impact: "M", probability: "M", owner: "", targetDate: "", status: "Open", link: "", comments: "" };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [m, setM] = useState(null);
  const rows = raid.filter((x) => x.projectId === project.id).sort((a, b) => (a.status === "Closed") - (b.status === "Closed") || (a.targetDate || "9999") < (b.targetDate || "9999") ? -1 : 1);
  const { rows: pageRows, pager } = usePaged(rows, 10);
  function save() {
    setM(null);
    if (!f.desc.trim()) return setM("A description is required.");
    if (editId) {
      setRaid(raid.map((x) => (x.id === editId ? { ...x, ...f, desc: f.desc.trim(), updatedAt: todayISO } : x)));
      setEditId(null);
    } else {
      setRaid([...raid, { ...f, id: nextId("rd"), projectId: project.id, desc: f.desc.trim(), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setF(empty);
  }
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-700">RAID log — {project.name}</div>
      {canEdit && (
        <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-6">
            <Field label="Type"><select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{RAID_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Impact (H/M/L)"><select className={inputCls} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}>{HML.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Probability (H/M/L)"><select className={inputCls} value={f.probability} onChange={(e) => setF({ ...f, probability: e.target.value })}>{HML.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Owner"><input className={inputCls} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="MDB / customer / name" /></Field>
            <Field label="Target date"><input type="date" className={inputCls} value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{RAID_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Field label="Description"><input className={inputCls} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="What's the risk / issue / dependency / decision" /></Field>
            <Field label="Linked item (Jira / Smartsheet / etc.)"><input className={inputCls} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="OPUSM-1234 or URL" /></Field>
            <Field label="Comments"><input className={inputCls} value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field>
          </div>
          {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
          <div className="mt-2 flex gap-2">
            <Btn small onClick={save}>{editId ? "Save changes" : "Add entry"}</Btn>
            {editId && <Btn small kind="ghost" onClick={() => { setEditId(null); setF(empty); }}>Cancel edit</Btn>}
          </div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No RAID entries{canEdit ? " — add the first above." : "."}</p> : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Type</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-center">Impact</th><th className="px-3 py-2 text-center">Prob.</th>
                <th className="px-3 py-2">Owner</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Linked</th><th className="px-3 py-2">Comments</th>{canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((x) => (
                <tr key={x.id} className={x.status === "Closed" ? "text-slate-400" : ""}>
                  <td className="px-3 py-1.5"><Pill tone={x.type === "Risk" ? "bg-amber-100 text-amber-800" : x.type === "Issue" ? "bg-red-100 text-red-800" : x.type === "Dependency" ? "bg-sky-100 text-sky-800" : "bg-purple-100 text-purple-800"}>{x.type}</Pill></td>
                  <td className="px-3 py-1.5 text-slate-700">{x.desc}</td>
                  <td className="px-3 py-1.5 text-center"><Pill tone={hmlPill(x.impact)}>{x.impact}</Pill></td>
                  <td className="px-3 py-1.5 text-center"><Pill tone={hmlPill(x.probability)}>{x.probability}</Pill></td>
                  <td className="px-3 py-1.5">{x.owner || "—"}</td>
                  <td className="px-3 py-1.5">
                    {x.targetDate ? (
                      <span className="inline-flex items-center gap-1">
                        {fmt(x.targetDate)}
                        {x.status !== "Closed" && x.targetDate < todayISO && <Pill tone="bg-red-100 text-red-800">overdue</Pill>}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-1.5"><Pill tone={x.status === "Closed" ? "bg-slate-100 text-slate-500" : x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>{x.status}</Pill></td>
                  <td className="px-3 py-1.5 text-xs">{x.link ? (/^https?:\/\//.test(x.link) ? <a href={x.link} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">{x.link.slice(0, 24)}…</a> : x.link) : "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{x.comments || "—"}</td>
                  {canEdit && <td className="px-2 py-1.5 text-right">
                    <span className="flex justify-end gap-1">
                      <Btn small kind="ghost" onClick={() => { setEditId(x.id); setF({ type: x.type, desc: x.desc, impact: x.impact, probability: x.probability, owner: x.owner || "", targetDate: x.targetDate || "", status: x.status, link: x.link || "", comments: x.comments || "" }); }}>Edit</Btn>
                      <Btn small kind="danger" onClick={() => setRaid(raid.filter((y) => y.id !== x.id))}>✕</Btn>
                    </span>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pager}
    </div>
  );
}

function MilestonePanel(ctx) {
  const { milestones, setMilestones, project, canEdit, nextId, todayISO, user } = ctx;
  const empty = { name: "", phase: "", planned: "", actual: "", status: "Not Started", rag: "Green", comments: "" };
  const [f, setF] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [m, setM] = useState(null);
  const rows = milestones.filter((x) => x.projectId === project.id).sort((a, b) => ((a.planned || "9999") < (b.planned || "9999") ? -1 : 1));
  const { rows: pageRows, pager } = usePaged(rows, 10);
  function save() {
    setM(null);
    if (!f.name.trim()) return setM("A milestone name is required.");
    if (f.status === "Complete" && !f.actual) return setM("A Complete milestone needs its actual date.");
    if (editId) {
      setMilestones(milestones.map((x) => (x.id === editId ? { ...x, ...f, name: f.name.trim(), updatedAt: todayISO } : x)));
      setEditId(null);
    } else {
      setMilestones([...milestones, { ...f, id: nextId("ms"), projectId: project.id, name: f.name.trim(), createdBy: user.name, createdAt: todayISO, updatedAt: todayISO }]);
    }
    setF(empty);
  }
  const slip = (x) => (x.planned && x.actual ? Math.round((parseISO(x.actual) - parseISO(x.planned)) / 86400000) : null);
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-700">Milestones — {project.name}</div>
      {canEdit && (
        <div className="mb-3 rounded-lg bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-7">
            <Field label="Milestone name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="UAT start" /></Field>
            <Field label="Phase">
              <select className={inputCls} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}>
                <option value="">—</option>
                {project.phases.map((ph) => <option key={ph}>{ph}</option>)}
              </select>
            </Field>
            <Field label="Planned date"><input type="date" className={inputCls} value={f.planned} onChange={(e) => setF({ ...f, planned: e.target.value })} /></Field>
            <Field label="Actual date"><input type="date" className={inputCls} value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{MS_STATUSES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="RAG"><select className={inputCls} value={f.rag} onChange={(e) => setF({ ...f, rag: e.target.value })}>{RAG_OPTS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Comments"><input className={inputCls} value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field>
          </div>
          {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
          <div className="mt-2 flex gap-2">
            <Btn small onClick={save}>{editId ? "Save changes" : "Add milestone"}</Btn>
            {editId && <Btn small kind="ghost" onClick={() => { setEditId(null); setF(empty); }}>Cancel edit</Btn>}
          </div>
        </div>
      )}
      {rows.length === 0 ? <p className="text-sm text-slate-500">No milestones{canEdit ? " — add the first above." : "."}</p> : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Milestone</th><th className="px-3 py-2">Phase</th><th className="px-3 py-2">Planned</th><th className="px-3 py-2">Actual</th><th className="px-3 py-2 text-right">Slip</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">RAG</th><th className="px-3 py-2">Comments</th>{canEdit && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((x) => {
                const s = slip(x);
                return (
                  <tr key={x.id} className={x.status === "Complete" ? "text-slate-500" : ""}>
                    <td className="px-3 py-1.5 font-medium text-slate-800">{x.name}</td>
                    <td className="px-3 py-1.5">{x.phase || "—"}</td>
                    <td className="px-3 py-1.5">{x.planned ? fmt(x.planned) : "—"}</td>
                    <td className="px-3 py-1.5">
                      {x.actual ? fmt(x.actual) : (x.planned && x.planned < todayISO && x.status !== "Complete" ? <Pill tone="bg-red-100 text-red-800">overdue</Pill> : "—")}
                    </td>
                    <td className="px-3 py-1.5 text-right">{s === null ? <span className="text-slate-300">—</span> : <span className={s > 0 ? "font-medium text-red-600" : s < 0 ? "font-medium text-emerald-700" : "text-slate-400"}>{s > 0 ? "+" + s : s} d</span>}</td>
                    <td className="px-3 py-1.5"><Pill tone={x.status === "Complete" ? "bg-emerald-100 text-emerald-800" : x.status === "In Progress" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}>{x.status}</Pill></td>
                    <td className="px-3 py-1.5"><Pill tone={ragPill(x.rag)}>{x.rag}</Pill></td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{x.comments || "—"}</td>
                    {canEdit && <td className="px-2 py-1.5 text-right">
                      <span className="flex justify-end gap-1">
                        <Btn small kind="ghost" onClick={() => { setEditId(x.id); setF({ name: x.name, phase: x.phase || "", planned: x.planned || "", actual: x.actual || "", status: x.status, rag: x.rag, comments: x.comments || "" }); }}>Edit</Btn>
                        <Btn small kind="danger" onClick={() => setMilestones(milestones.filter((y) => y.id !== x.id))}>✕</Btn>
                      </span>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pager}
    </div>
  );
}

function ProjectsView(ctx) {
  const { projects, setProjects, assignments, employees, empByName, weekendDays, holidaySet, nextId, todayISO, raid, milestones } = ctx;
  const canConfigure = ctx.can("projects.manage");
  const [year, setYear] = useState(2026);
  const [pform, setPform] = useState({ name: "", phases: "", streams: "", description: "", linkLabel: "", linkUrl: "", start: "", end: "", targetMargin: "", pm: "", currentPhase: "" });
  const canRaid = ctx.can("projects.raid");
  const [panel, setPanel] = useState(null); // { id: projectId, tab: "raid" | "ms" }
  const [pedit, setPedit] = useState(null); // { id, phases, streams, description, linkLabel, linkUrl }
  const [msg, setMsg] = useState(null);
  const r1 = (x) => Math.round(x * 10) / 10;
  const burn = useMemo(() => computeBurn(assignments, employees, empByName, year, weekendDays, holidaySet),
    [assignments, employees, empByName, year, weekendDays, holidaySet]);

  function addProject() {
    setMsg(null);
    const name = pform.name.trim();
    if (!name) return setMsg({ tone: "error", text: "Project name is required." });
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return setMsg({ tone: "error", text: "A project named " + name + " already exists." });
    const phases = pform.phases.split(",").map((s) => s.trim()).filter(Boolean);
    const streams = pform.streams.split(",").map((s) => s.trim()).filter(Boolean);
    if (pform.linkUrl && !/^https?:\/\//.test(pform.linkUrl.trim())) return setMsg({ tone: "error", text: "External link must start with http:// or https://" });
    if (pform.start && pform.end && pform.end < pform.start) return setMsg({ tone: "error", text: "Target end date can't be before the start date." });
    const tm = pform.targetMargin === "" ? null : Number(pform.targetMargin);
    if (tm !== null && (isNaN(tm) || tm < 0 || tm > 100)) return setMsg({ tone: "error", text: "Target margin must be a percentage between 0 and 100." });
    setProjects([...projects, { id: nextId("p"), name, phases, streams, trackJira: true, description: pform.description.trim(), linkLabel: pform.linkLabel.trim(), linkUrl: pform.linkUrl.trim(), start: pform.start || null, end: pform.end || null, targetMargin: tm, pm: pform.pm || null, currentPhase: pform.currentPhase || null }]);
    setPform({ name: "", phases: "", streams: "", description: "", linkLabel: "", linkUrl: "", start: "", end: "", targetMargin: "", pm: "", currentPhase: "" });
    setMsg({ tone: "ok", text: "Project " + name + " created" + (phases.length ? " with phases " + phases.join(", ") : "") + "." });
  }
  function deleteProject(p) {
    if (assignments.some((a) => a.projectId === p.id)) return setMsg({ tone: "error", text: p.name + " has assignments — reassign or delete those first." });
    setProjects(projects.filter((x) => x.id !== p.id));
  }
  function toggleJira(p) {
    setProjects(projects.map((x) => (x.id === p.id ? { ...x, trackJira: x.trackJira === false } : x)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Projects ({projects.length})</h2>
        <select className={inputCls + " w-28"} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {!canConfigure && <Notice tone="warn">View only — the project master is maintained by the Project Manager. Leads assign people to these projects from Allocations.</Notice>}
      {canConfigure && (
        <Card title="Create project">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Project name"><input className={inputCls} value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} placeholder="e.g. Bendigo AppDev" /></Field>
            <Field label="Phases (comma-separated, optional)"><input className={inputCls} value={pform.phases} onChange={(e) => setPform({ ...pform, phases: e.target.value })} placeholder="R1, R2" /></Field>
            <Field label="Streams (comma-separated, optional)"><input className={inputCls} value={pform.streams} onChange={(e) => setPform({ ...pform, streams: e.target.value })} placeholder="Bugs, Batches, PM" /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Description (optional)"><input className={inputCls} value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} placeholder="What this engagement covers" /></Field>
            <Field label="External link label (optional)"><input className={inputCls} value={pform.linkLabel} onChange={(e) => setPform({ ...pform, linkLabel: e.target.value })} placeholder="SOW folder / JIRA board" /></Field>
            <Field label="External link URL"><input className={inputCls} value={pform.linkUrl} onChange={(e) => setPform({ ...pform, linkUrl: e.target.value })} placeholder="https://…" /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Start date (optional)"><input type="date" className={inputCls} value={pform.start} onChange={(e) => setPform({ ...pform, start: e.target.value })} /></Field>
            <Field label="Target end date (optional)"><input type="date" className={inputCls} value={pform.end} onChange={(e) => setPform({ ...pform, end: e.target.value })} /></Field>
            <Field label="Target margin % (optional · PM/Admin only)"><input type="number" min="0" max="100" step="0.1" className={inputCls} value={pform.targetMargin} onChange={(e) => setPform({ ...pform, targetMargin: e.target.value })} placeholder="e.g. 35" /></Field>
            <Field label="Project manager (owner)">
              <select className={inputCls} value={pform.pm} onChange={(e) => setPform({ ...pform, pm: e.target.value })}>
                <option value="">—</option>
                {employees.filter((e) => e.role === "Project Manager" && isActiveDuring(e, todayISO, todayISO)).map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3"><Btn onClick={addProject}>Create project</Btn></div>
        </Card>
      )}
      {projects.map((p) => {
        const g = burn.agg[p.id] || { total: 0, byPhase: {}, byStream: {}, people: new Set() };
        const todayActive = new Set(assignments.filter((a) => a.projectId === p.id && a.from <= todayISO && todayISO <= (a.to || OPEN_END)).map((a) => a.name));
        const maxPh = Math.max(1, ...Object.values(g.byPhase));
        const maxSt = Math.max(1, ...Object.values(g.byStream));
        return (
          <Card key={p.id} title={p.name + (p.phases.length ? " — phases: " + p.phases.join(", ") : "")}
            right={canConfigure && <span className="flex gap-2"><Btn small kind="ghost" onClick={() => setPedit({ id: p.id, phases: p.phases.join(", "), streams: (p.streams || []).join(", "), description: p.description || "", linkLabel: p.linkLabel || "", linkUrl: p.linkUrl || "", start: p.start || "", end: p.end || "", targetMargin: p.targetMargin ?? "", pm: p.pm || "", currentPhase: p.currentPhase || "" })}>Edit</Btn><Btn small kind="danger" onClick={() => deleteProject(p)}>Delete</Btn></span>}>
            {(p.start || p.end || p.pm || p.currentPhase || (p.targetMargin !== null && p.targetMargin !== undefined)) && pedit?.id !== p.id && (
              <div className="mb-2 flex flex-wrap gap-2 text-xs">
                {p.pm && <Pill tone="bg-sky-100 text-sky-800">PM: {p.pm}</Pill>}
                {p.currentPhase && <Pill tone="bg-indigo-100 text-indigo-800">Phase: {p.currentPhase}</Pill>}
                {p.start && <Pill tone="bg-slate-100 text-slate-600">Start {fmt(p.start)}</Pill>}
                {p.end && <Pill tone={p.end < todayISO ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}>Target end {fmt(p.end)}{p.end < todayISO ? " · past due" : ""}</Pill>}
                {p.targetMargin !== null && p.targetMargin !== undefined && (ctx.user.role === "Project Manager" || ctx.user.role === "Admin") && <Pill tone="bg-purple-100 text-purple-800">Target margin {p.targetMargin}%</Pill>}
              </div>
            )}
            {(p.description || p.linkUrl || (p.streams || []).length > 0) && pedit?.id !== p.id && (
              <div className="mb-3 space-y-1 text-sm">
                {p.description && <p className="text-slate-600">{p.description}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 underline decoration-emerald-300 hover:decoration-emerald-700">{p.linkLabel || p.linkUrl} ↗</a>}
                  {(p.streams || []).map((s) => <Pill key={s} tone={STREAM_COLORS[s] || "bg-slate-100 text-slate-600"}>{s}</Pill>)}
                  {(p.streams || []).length === 0 && <span className="text-xs text-slate-400">No streams defined — assignments on this project carry no stream.</span>}
                </div>
              </div>
            )}
            <div className="mb-2 flex flex-wrap gap-2">
              <Btn small kind={panel?.id === p.id && panel.tab === "raid" ? "primary" : "ghost"} onClick={() => setPanel(panel?.id === p.id && panel.tab === "raid" ? null : { id: p.id, tab: "raid" })}>
                RAID log ({raid.filter((x) => x.projectId === p.id && x.status !== "Closed").length} open / {raid.filter((x) => x.projectId === p.id).length})
              </Btn>
              <Btn small kind={panel?.id === p.id && panel.tab === "ms" ? "primary" : "ghost"} onClick={() => setPanel(panel?.id === p.id && panel.tab === "ms" ? null : { id: p.id, tab: "ms" })}>
                Milestones ({milestones.filter((x) => x.projectId === p.id && x.status !== "Complete").length} pending / {milestones.filter((x) => x.projectId === p.id).length})
              </Btn>
            </div>
            {panel?.id === p.id && panel.tab === "raid" && <RaidPanel {...ctx} project={p} canEdit={canRaid} />}
            {panel?.id === p.id && panel.tab === "ms" && <MilestonePanel {...ctx} project={p} canEdit={canRaid} />}
            {pedit && pedit.id === p.id && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Phases (comma-separated)"><input className={inputCls} value={pedit.phases} onChange={(e) => setPedit({ ...pedit, phases: e.target.value })} /></Field>
                  <Field label="Streams (comma-separated)"><input className={inputCls} value={pedit.streams} onChange={(e) => setPedit({ ...pedit, streams: e.target.value })} /></Field>
                  <Field label="Description"><input className={inputCls} value={pedit.description} onChange={(e) => setPedit({ ...pedit, description: e.target.value })} /></Field>
                  <Field label="Link label"><input className={inputCls} value={pedit.linkLabel} onChange={(e) => setPedit({ ...pedit, linkLabel: e.target.value })} /></Field>
                  <Field label="Link URL"><input className={inputCls} value={pedit.linkUrl} onChange={(e) => setPedit({ ...pedit, linkUrl: e.target.value })} /></Field>
                  <Field label="Start date"><input type="date" className={inputCls} value={pedit.start} onChange={(e) => setPedit({ ...pedit, start: e.target.value })} /></Field>
                  <Field label="Target end date"><input type="date" className={inputCls} value={pedit.end} onChange={(e) => setPedit({ ...pedit, end: e.target.value })} /></Field>
                  <Field label="Target margin %"><input type="number" min="0" max="100" step="0.1" className={inputCls} value={pedit.targetMargin} onChange={(e) => setPedit({ ...pedit, targetMargin: e.target.value })} /></Field>
                  <Field label="Project manager (owner)">
                    <select className={inputCls} value={pedit.pm} onChange={(e) => setPedit({ ...pedit, pm: e.target.value })}>
                      <option value="">—</option>
                      {employees.filter((e) => e.role === "Project Manager" && isActiveDuring(e, todayISO, todayISO)).map((e) => <option key={e.id}>{e.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Current phase (for reporting)">
                    <select className={inputCls} value={pedit.currentPhase} onChange={(e) => setPedit({ ...pedit, currentPhase: e.target.value })}>
                      <option value="">—</option>
                      {pedit.phases.split(",").map((s) => s.trim()).filter(Boolean).map((ph) => <option key={ph}>{ph}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-end gap-2">
                    <Btn small onClick={() => {
                      if (pedit.linkUrl && !/^https?:\/\//.test(pedit.linkUrl.trim())) return setMsg({ tone: "error", text: "External link must start with http:// or https://" });
                      if (pedit.start && pedit.end && pedit.end < pedit.start) return setMsg({ tone: "error", text: "Target end date can't be before the start date." });
                      const tm2 = pedit.targetMargin === "" || pedit.targetMargin === null ? null : Number(pedit.targetMargin);
                      if (tm2 !== null && (isNaN(tm2) || tm2 < 0 || tm2 > 100)) return setMsg({ tone: "error", text: "Target margin must be a percentage between 0 and 100." });
                      setProjects(projects.map((x) => x.id === p.id ? { ...x,
                        phases: pedit.phases.split(",").map((s) => s.trim()).filter(Boolean),
                        streams: pedit.streams.split(",").map((s) => s.trim()).filter(Boolean),
                        description: pedit.description.trim(), linkLabel: pedit.linkLabel.trim(), linkUrl: pedit.linkUrl.trim(),
                        start: pedit.start || null, end: pedit.end || null, targetMargin: tm2, pm: pedit.pm || null, currentPhase: pedit.currentPhase || null } : x));
                      setPedit(null);
                      setMsg({ tone: "ok", text: p.name + " updated." });
                    }}>Save</Btn>
                    <Btn small kind="ghost" onClick={() => setPedit(null)}>Cancel</Btn>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Removing a stream doesn't touch existing assignments — they keep their recorded stream; new assignments only offer the streams listed here.</p>
              </div>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">On it today</div><div className="text-lg font-semibold">{todayActive.size}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">People in {year}</div><div className="text-lg font-semibold">{g.people.size}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Effort {year} (days)</div><div className="text-lg font-semibold">{r1(g.total)}</div></div>
              <label className={"ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm " + (canConfigure ? "cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50" : "border-slate-200 text-slate-400")}>
                <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={p.trackJira !== false} disabled={!canConfigure} onChange={() => toggleJira(p)} />
                Count JIRA in timecard score
              </label>
            </div>
            {g.total === 0 ? <p className="text-sm text-slate-500">No effort lands in {year} yet — assign people from Allocations → Plan.</p> : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">By phase</div>
                  {Object.entries(g.byPhase).sort((a, b) => b[1] - a[1]).map(([ph, v]) => (
                    <div key={ph} className="mb-1 flex items-center gap-2 text-xs">
                      <div className="w-16 shrink-0 truncate font-medium text-slate-700">{ph}</div>
                      <div className="h-4 flex-1 rounded bg-slate-100"><div className="mdb-bar h-4 rounded" style={{ width: Math.max(4, Math.round((v / maxPh) * 100)) + "%" }} /></div>
                      <div className="w-12 shrink-0 text-right text-slate-500">{r1(v)}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">By stream</div>
                  {Object.entries(g.byStream).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, v]) => (
                    <div key={s} className="mb-1 flex items-center gap-2 text-xs">
                      <div className="w-32 shrink-0 truncate"><Pill tone={STREAM_COLORS[s] || "bg-slate-100 text-slate-600"}>{s}</Pill></div>
                      <div className="h-4 flex-1 rounded bg-slate-100"><div className="mdb-bar h-4 rounded" style={{ width: Math.max(4, Math.round((v / maxSt) * 100)) + "%" }} /></div>
                      <div className="w-12 shrink-0 text-right text-slate-500">{r1(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// EMPLOYEES (Lead view · PM/Admin edit)
// ============================================================
function EmployeesView(ctx) {
  const { employees, setEmployees, nextId, todayISO, empFields, setEmpFields } = ctx;
  const canConfigure = ctx.can("employees.edit");
  const isAdmin = ctx.user.role === "Admin";
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [edit, setEdit] = useState(null); // employee object or "new"
  const [msg, setMsg] = useState(null);
  const activeCount = employees.filter((e) => isActiveDuring(e, todayISO, todayISO)).length;
  const rows = employees
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!activeOnly || isActiveDuring(e, todayISO, todayISO)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const { rows: pageRows, pager } = usePaged(rows, 25);
  function save(form) {
    setMsg(null);
    if (!form.name.trim()) return setMsg({ tone: "error", text: "Name is required." });
    const clash = employees.find((e) => e.name.trim() === form.name.trim() && e.id !== form.id);
    if (clash) return setMsg({ tone: "error", text: "An employee named " + form.name + " already exists — names must be unique (they key all three trackers)." });
    if (form.term && form.start && form.term < form.start) return setMsg({ tone: "error", text: "End date can't be before the start date." });
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setMsg({ tone: "error", text: "That doesn't look like a valid email address." });
    const emailClash = form.email && employees.find((e) => e.email && e.email.toLowerCase() === form.email.trim().toLowerCase() && e.id !== form.id);
    if (emailClash) return setMsg({ tone: "error", text: "That email is already on " + emailClash.name + " — emails are the login identity and must be unique." });
    if (form.email) form = { ...form, email: form.email.trim().toLowerCase() };
    if (form.id) setEmployees(employees.map((e) => (e.id === form.id ? form : e)));
    else setEmployees([...employees, { ...form, id: nextId("e") }]);
    setEdit(null);
    setMsg({ tone: "ok", text: "Employee saved." });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Employee Master ({activeCount} active · {employees.length} total)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active only
          </label>
          <input className={inputCls + " w-56"} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {canConfigure && <Btn onClick={() => setEdit({ id: null, name: "", email: "", role: "Developer", company: "MDB", start: "", term: null, streamLead: false, viewer: false, custom: {} })}>Add employee</Btn>}
        </div>
      </div>
      {!canConfigure && <Notice tone="warn">View only — the employee master is maintained by the Project Manager (same rule as the source tracker).</Notice>}
      {msg && <Notice tone={msg.tone === "error" ? "error" : "ok"}>{msg.text}</Notice>}
      {edit && canConfigure && (
        <Card title={edit.id ? "Edit " + edit.name : "New employee"}>
          <EmpForm initial={edit} empFields={empFields} onSave={save} onCancel={() => setEdit(null)} />
        </Card>
      )}
      {isAdmin && <CustomFieldsCard empFields={empFields} setEmpFields={setEmpFields} nextId={nextId} />}
      <Card>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email (login identity)</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Company</th><th className="py-2 pr-4">Start</th><th className="py-2 pr-4">End date</th>{empFields.map((cf) => <th key={cf.id} className="py-2 pr-4">{cf.label}</th>)}{canConfigure && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 pr-4 font-medium text-slate-800">{e.name}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{e.email || <span className="text-amber-600" title="No email — this person can't log in to the live app">not set</span>}</td>
                  <td className="py-1.5 pr-4"><Pill tone={e.role === "Project Manager" ? "bg-purple-100 text-purple-800" : e.role === "Lead Developer" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}>{e.role}</Pill>{e.streamLead && <Pill tone="ml-1 bg-indigo-100 text-indigo-800">Stream Lead</Pill>}{e.viewer && <Pill tone="ml-1 bg-teal-100 text-teal-800">Viewer</Pill>}</td>
                  <td className="py-1.5 pr-4 text-slate-600">{e.company}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{fmt(e.start)}</td>
                  <td className="py-1.5 pr-4 text-slate-500">
                    {e.term ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmt(e.term)}
                        <Pill tone={e.term <= todayISO ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>{e.term <= todayISO ? "Ended" : "Ending"}</Pill>
                      </span>
                    ) : "—"}
                  </td>
                  {empFields.map((cf) => <td key={cf.id} className="py-1.5 pr-4 text-slate-600">{(e.custom || {})[cf.id] || <span className="text-slate-300">—</span>}</td>)}
                  {canConfigure && <td className="py-1.5 text-right"><Btn small kind="ghost" onClick={() => setEdit({ ...e, email: e.email || "", custom: { ...(e.custom || {}) } })}>Edit</Btn></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pager}
      </Card>
    </div>
  );
}
function EmpForm({ initial, empFields = [], onSave, onCancel }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setCustom = (id) => (e) => setF({ ...f, custom: { ...(f.custom || {}), [id]: e.target.value } });
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Full name"><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label="Email (login identity)"><input type="email" className={inputCls} value={f.email || ""} onChange={set("email")} placeholder="name@company.com" /></Field>
        <Field label="Role">
          <select className={inputCls} value={f.role} onChange={set("role")}>
            {["Developer", "Senior Developer", "Lead Developer", "Project Manager"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Company">
          <select className={inputCls} value={f.company} onChange={set("company")}>
            {["MDB", "WeKan", "Ciklum", "Globant"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" className={inputCls} value={f.start || ""} onChange={set("start")} /></Field>
        <Field label="End date (last working day; leave blank if ongoing)"><input type="date" className={inputCls} value={f.term || ""} onChange={(e) => setF({ ...f, term: e.target.value || null })} /></Field>
      </div>
      {(f.role === "Developer" || f.role === "Senior Developer") && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={!!f.streamLead} onChange={(e) => setF({ ...f, streamLead: e.target.checked })} />
          Stream Lead — grants Lead access (leave management, timecards, allocations, performance scoring)
        </label>
      )}
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={!!f.viewer} onChange={(e) => setF({ ...f, viewer: e.target.checked })} />
        Viewer — read-only access to everything; can't add or update until granted in the permission matrix (overrides other access)
      </label>
      {empFields.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {empFields.map((cf) => (
            <Field key={cf.id} label={cf.label}>
              <input className={inputCls} value={(f.custom || {})[cf.id] || ""} onChange={setCustom(cf.id)} />
            </Field>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Btn onClick={() => onSave(f)}>Save employee</Btn>
        <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </div>
  );
}

// ============================================================
// LEAVE SETTINGS (PM / Admin)
// ============================================================
function SettingsView(ctx) {
  const { leaveTypes, setLeaveTypes, weekendDays, setWeekendDays, holidays, setHolidays } = ctx;
  const [newType, setNewType] = useState("");
  const [newVal, setNewVal] = useState("1");
  const [newHol, setNewHol] = useState("");
  const [msg, setMsg] = useState(null);
  function addType() {
    setMsg(null);
    const n = newType.trim();
    if (!n) return;
    if (leaveTypes.length >= 5) return setMsg({ tone: "error", text: "The tracker supports up to 5 leave types (source-tracker rule). Remove one first." });
    if (leaveTypes.some((t) => t.name.toLowerCase() === n.toLowerCase())) return setMsg({ tone: "error", text: "That leave type already exists." });
    setLeaveTypes([...leaveTypes, { name: n, value: Number(newVal) }]);
    setNewType("");
  }
  function addHoliday() {
    setMsg(null);
    if (!newHol) return;
    if (holidays.includes(newHol)) return setMsg({ tone: "error", text: "That date is already a holiday." });
    setHolidays([...holidays, newHol].sort());
    setNewHol("");
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Leave Settings</h2>
      <Notice tone="warn">Changing these recalculates every balance and calendar instantly — the whole app reads from this single config, replacing the SETTINGS sheet.</Notice>
      {msg && <Notice tone="error">{msg.text}</Notice>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={"Leave types (" + leaveTypes.length + "/5)"}>
          <ul className="mb-3 divide-y divide-slate-100">
            {leaveTypes.map((t) => (
              <li key={t.name} className="flex items-center justify-between py-2 text-sm">
                <span><Pill tone={LEAVE_COLORS[t.name] || "bg-slate-100 text-slate-600"}>{t.name}</Pill><span className="ml-2 text-xs text-slate-500">{t.value} day / working day</span></span>
                <Btn small kind="danger" onClick={() => setLeaveTypes(leaveTypes.filter((x) => x.name !== t.name))}>Remove</Btn>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="New type" value={newType} onChange={(e) => setNewType(e.target.value)} />
            <select className={inputCls + " w-24"} value={newVal} onChange={(e) => setNewVal(e.target.value)}>
              <option value="1">1</option><option value="0.5">0.5</option>
            </select>
            <Btn small onClick={addType}>Add</Btn>
          </div>
        </Card>
        <Card title="Weekend days">
          <div className="space-y-1">
            {DOW.map((d, i) => (
              <label key={d} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className={weekendDays.includes(i) ? "font-medium text-slate-800" : "text-slate-500"}>{d}</span>
                <input
                  type="checkbox"
                  checked={weekendDays.includes(i)}
                  onChange={() =>
                    setWeekendDays(weekendDays.includes(i) ? weekendDays.filter((x) => x !== i) : [...weekendDays, i])
                  }
                  className="h-4 w-4 accent-emerald-700"
                />
              </label>
            ))}
          </div>
        </Card>
        <Card title={"Holidays (" + holidays.length + ")"}>
          <div className="mb-3 flex gap-2">
            <input type="date" className={inputCls} value={newHol} onChange={(e) => setNewHol(e.target.value)} />
            <Btn small onClick={addHoliday}>Add</Btn>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-auto">
            {holidays.map((h) => (
              <li key={h} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-700">{fmt(h)}</span>
                <Btn small kind="danger" onClick={() => setHolidays(holidays.filter((x) => x !== h))}>Remove</Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PANEL
// ============================================================
function AdminPanel(ctx) {
  const { employees, leaves, comps, tcRows, tcWeeks, todayISO } = ctx;
  const activeCount = employees.filter((e) => isActiveDuring(e, todayISO, todayISO)).length;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>Administration</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Employees" value={employees.length} sub={activeCount + " active today (end dates respected)"} />
        <Stat label="Leave records" value={leaves.length} />
        <Stat label="Comp-off entries" value={comps.length} />
        <Stat label="Timecard rows" value={tcRows.length} sub={tcWeeks.length + " weeks · " + ctx.assignments.length + " assignments · " + ctx.scores.length + " perf scores"} />
      </div>
      <Card title="Permissions — per module, per capability (changes apply instantly)"
        right={<Btn small kind="ghost" onClick={() => ctx.setPerms(defaultPerms())}>Reset to defaults</Btn>}>
        <p className="mb-3 text-sm text-slate-500">Core rights are fixed: everyone submits their own leave, sees the team calendar and their own timecard; Admin always has everything. Everything else is editable below per role. Stream Leads inherit the Lead column; Viewers browse everything and write nothing until granted here.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Capability</th>
                {["Developer", "Lead", "Project Manager", "Viewer"].map((r) => <th key={r} className="py-2 pr-4 text-center">{r}</th>)}
                <th className="py-2 pr-4 text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map((g) => [
                <tr key={g.module} className="bg-slate-50">
                  <td colSpan={6} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.module}</td>
                </tr>,
                ...g.caps.map(([id, label]) => (
                  <tr key={id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-slate-700">{label}</td>
                    {["Developer", "Lead", "Project Manager", "Viewer"].map((r) => (
                      <td key={r} className="py-1.5 pr-4 text-center">
                        <input type="checkbox" className="h-4 w-4 cursor-pointer accent-emerald-700"
                          checked={!!(ctx.perms[id] && ctx.perms[id][r])}
                          onChange={(e) => ctx.setPerms({ ...ctx.perms, [id]: { ...ctx.perms[id], [r]: e.target.checked } })} />
                      </td>
                    ))}
                    <td className="py-1.5 pr-4 text-center"><span className="text-emerald-600" title="Admin always has full access">●</span></td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      <ExtLinksCard {...ctx} />
      <Card title="Shipped in v2.3 — Remaining Runway">
        <p className="text-sm text-slate-700">Per-role runway per project, reproducing the source sheet's model with its bugs fixed: remaining billable hours ÷ weekly burn (headcount × 40 h, per-assignment overrides honoured — e.g. the three 48 h/week developers), projected from the week anchor with real working-day math. Remaining hours are derived from allocations (8 h per working day, day-weighted across concurrent projects, from the funding start) with per-role manual overrides for finance corrections. The last date is extended by real approved leave — fixing the source formula that passed a leave-day count where WORKDAY expects holiday dates, so forecasts never actually shifted anything. Pricing rows from the source sheet remain excluded.</p>
      </Card>
      <Card title="Shipped in v2.2 — Performance">
        <p className="text-sm text-slate-700">Weekly partner scoring exactly per the locked decisions: partner resources only (WeKan · Globant · Ciklum) with an Admin switch to extend to MDB; Config-tab weights as baseline (Delivery 25 · Quality 20 · Communication 10 · Tech 25 · Timecard 10 · Collaboration 10), Admin-editable with a must-total-100 guard; RAG Green ≥ 3.5 / Amber ≥ 2.5; Leads (including Stream Leads) score openly; Developers never see the module. 60 real scoring rows migrated from the source tracker (12 weeks, with the drag-filled 2029–2062 week dates corrected to 2026 and four name variants reconciled). Timecard metric offers a one-click suggestion derived from each person's proactiveness %.</p>
      </Card>
      <Card title="Shipped in v2.1 — Allocations (merged with Team Plans)">
        <p className="text-sm text-slate-700">Project → Phase → Stream assignments with date ranges (same-project overlaps blocked; concurrent projects allowed with even day-weighted FTE split) · allocation status derived from active assignments · retention tracking dropped by decision · projected burn (effort days, FTE, unallocated) derived from ranges against real working days, clipped to employment windows · pricing excluded (revisits in Runway, Admin-only) · Lead, PM and Admin can all create and edit assignments. Source-data note: the Excel allocation grid was empty (2 cells), so this module starts greenfield with those two real assignments seeded.</p>
      </Card>
      <Card title="v2 modules — decisions already locked">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Allocations:</span> monthly stream allocation (14 streams from the source Config), retention remarks and projected burn — the data backbone (Name · Company · Release · Role) is already shared with this app.</li>
          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Program Health</span> (from AMP APAC Program Health v2.0 — analysed, sequenced ahead of Runway since it feeds it): pipeline stage board (7 opportunities), active project register with KPIs and RAG, weekly health via a single entry form replacing the sheet-per-project pattern, milestone slip timeline, RAID log with aging, decision tracker. Open questions for the build round: margin visibility (Admin-only or excluded, like pricing), meaning of the pipeline "xW" column, weekly-entry ownership, and a correction pass on the corrupted Bendigo week dates during migration.</li>

          <li className="rounded-lg bg-slate-50 p-3"><span className="font-semibold">Team Plans:</span> per-project planning — assign people to streams with allocation % and date ranges, flag over-allocation across projects, and validate planned capacity against the leave calendar. Extends Allocations from a read-only grid to a planning tool.</li>
        </ul>
      </Card>
    </div>
  );
}

// Custom employee fields manager (Admin) — labels defined here become inputs on every employee
function CustomFieldsCard({ empFields, setEmpFields, nextId }) {
  const [label, setLabel] = useState("");
  const [m, setM] = useState(null);
  function add() {
    setM(null);
    const t = label.trim();
    if (!t) return setM("A field label is required.");
    if (empFields.some((f) => f.label.toLowerCase() === t.toLowerCase())) return setM("A field with that label already exists.");
    if (empFields.length >= 8) return setM("Up to 8 custom fields — the master table needs to stay readable.");
    setEmpFields([...empFields, { id: nextId("cf"), label: t }]);
    setLabel("");
  }
  return (
    <Card title={"Custom employee fields (" + empFields.length + "/8)"}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="New field label"><input className={inputCls + " w-64"} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Employee ID, JIRA handle, Location" onKeyDown={(e) => e.key === "Enter" && add()} /></Field>
        <Btn small onClick={add}>Add field</Btn>
      </div>
      {m && <div className="mt-2"><Notice tone="error">{m}</Notice></div>}
      {empFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {empFields.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
              {f.label}
              <button className="text-slate-400 hover:text-red-600" title="Remove field (stored values are kept and reappear if you re-add it)" onClick={() => setEmpFields(empFields.filter((x) => x.id !== f.id))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Fields appear as free-text inputs on every employee and as columns in the master table. Removing a field hides it but keeps stored values.</p>
    </Card>
  );
}

// External application links manager (Admin) — rendered in every user's sidebar
function ExtLinksCard(ctx) {
  const { extLinks, setExtLinks, nextId } = ctx;
  const [f, setF] = useState({ label: "", url: "", description: "" });
  const [msg, setMsg] = useState(null);
  function add() {
    setMsg(null);
    if (!f.label.trim()) return setMsg("A label is required — it's the menu text.");
    if (!/^https?:\/\//.test(f.url.trim())) return setMsg("The URL must start with http:// or https://");
    if (extLinks.some((l) => l.label.toLowerCase() === f.label.trim().toLowerCase())) return setMsg("A link with that label already exists.");
    setExtLinks([...extLinks, { id: nextId("x"), label: f.label.trim(), url: f.url.trim(), description: f.description.trim() }]);
    setF({ label: "", url: "", description: "" });
  }
  return (
    <Card title={"External application links (" + extLinks.length + ") — shown in everyone's sidebar under \"Links\""}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Menu label"><input className={inputCls} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="JIRA board" /></Field>
        <Field label="URL"><input className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Description (hover tooltip)"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Sprint board for OPUSM R2" /></Field>
        <div className="self-end"><Btn small onClick={add}>Add link</Btn></div>
      </div>
      {msg && <div className="mt-2"><Notice tone="error">{msg}</Notice></div>}
      {extLinks.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {extLinks.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium text-slate-800">{l.label}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-emerald-700 underline">{l.url}</a>
                {l.description && <span className="ml-2 text-xs text-slate-400">{l.description}</span>}
              </span>
              <Btn small kind="danger" onClick={() => setExtLinks(extLinks.filter((x) => x.id !== l.id))}>Remove</Btn>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400">Links open in a new tab. Visible to every role — keep them non-sensitive.</p>
    </Card>
  );
}

// ============================================================
// COMING SOON (locked v2 modules)
// ============================================================
function ComingSoon({ id, role }) {
  const m = MODULES_V2.find((x) => x.id === id);
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🔒</div>
        <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: BRAND_FONT }}>{m ? m.label : "Module"} arrives in v2</h2>
        <p className="mt-2 text-sm text-slate-500">{m ? m.note : ""}</p>
        <p className="mt-3 text-xs text-slate-400">The role model, employee backbone and navigation are already wired for it — enabling this module won't require rework. You're seeing this because your role ({role}) will have access when it ships.</p>
      </div>
    </div>
  );
}
