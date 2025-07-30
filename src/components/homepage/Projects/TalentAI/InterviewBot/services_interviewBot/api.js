import axios from "axios";

const INTERVIEW_API = import.meta.env.VITE_TALENTAI_API_INTERVIEW_BASE_URL;
export default axios.create({ baseURL: `${INTERVIEW_API}/api` });
