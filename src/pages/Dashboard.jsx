import React, { useState } from "react";
import Navbar from "../components/Navbar";
import UsersPage from "./UsersPage";
import RecentChats from "./RecentChats";

const Dashboard = () => {
  const [activePage, setActivePage] = useState("recent");
  return (
    <>
      <Navbar activePage={activePage} setActivePage={setActivePage} />
      {activePage === "recent" ? <RecentChats /> : <UsersPage />}
    </>
  );
};

export default Dashboard;
