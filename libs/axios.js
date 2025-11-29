import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://judgingbackend.damrufest.org",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  maxRedirects: 0,
});

export default axiosInstance;
