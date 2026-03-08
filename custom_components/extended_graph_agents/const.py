"""Constants for Extended Graph Agents."""
DOMAIN = "extended_graph_agents"
CONF_API_KEY = "api_key"
CONF_BASE_URL = "base_url"
CONF_CHAT_MODEL = "chat_model"
CONF_MAX_TOKENS = "max_tokens"
CONF_TEMPERATURE = "temperature"
CONF_GRAPH_ID = "graph_id"

DEFAULT_CHAT_MODEL = "gpt-4o"
DEFAULT_MAX_TOKENS = 2000
DEFAULT_TEMPERATURE = 1.0
DEFAULT_BASE_URL = "https://api.openai.com/v1"

GRAPHS_SUBDIR = "extended_graph_agents/graphs"
SKILLS_SUBDIR = "extended_graph_agents/skills"

EVENT_GRAPH_EXECUTION_STARTED = f"{DOMAIN}_execution_started"
EVENT_GRAPH_EXECUTION_FINISHED = f"{DOMAIN}_execution_finished"
EVENT_NODE_STARTED = f"{DOMAIN}_node_started"
EVENT_NODE_FINISHED = f"{DOMAIN}_node_finished"
